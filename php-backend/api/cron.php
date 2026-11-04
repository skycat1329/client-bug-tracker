<?php
// ==============================================================================
// Assurance Media - Automated Cron Jobs Runner
// Supports both CLI execution (/usr/bin/php) and HTTP Webhooks (curl/wget)
// ==============================================================================

ini_set('display_errors', '1');
error_reporting(E_ALL);
date_default_timezone_set('Asia/Kolkata');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// 1. Authentication Check
$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    
    // Check Secret Token from GET, POST, or Authorization header
    $providedSecret = $_GET['secret'] ?? $_POST['secret'] ?? '';
    if (empty($providedSecret) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $m)) {
            $providedSecret = trim($m[1]);
        }
    }

    if (empty($providedSecret) || $providedSecret !== CRON_SECRET) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Unauthorized: Invalid or missing cron secret token.'
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

$startTime = microtime(true);
$task = $_GET['task'] ?? $_POST['task'] ?? $argv[1] ?? 'all';
$results = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s T'),
    'task' => $task,
    'mode' => $isCli ? 'CLI' : 'HTTP',
    'actions' => []
];

// Helper to safely execute any cron action
function run_safe_cron_action(string $name, callable $fn): array {
    try {
        return $fn();
    } catch (Throwable $e) {
        return [
            'name' => $name,
            'status' => 'error',
            'error' => $e->getMessage()
        ];
    }
}

// ------------------------------------------------------------------------------
// Task 1: Auto Punch-Out for Forgotten Check-Outs (End of Day Processing)
// ------------------------------------------------------------------------------
function cron_auto_checkout(): array {
    $today = date('Y-m-d');
    
    // Find unclosed punch-ins from yesterday or today where shift has passed (past 20:30 IST)
    $unclosed = db_query(
        "SELECT a.*, u.name as user_name 
         FROM attendance a 
         JOIN users u ON a.user_id = u.id 
         WHERE a.check_in_time IS NOT NULL 
           AND a.check_out_time IS NULL 
           AND (a.attendance_date < ? OR (a.attendance_date = ? AND CURRENT_TIME() >= '20:30:00'))",
        [$today, $today]
    );

    $count = 0;
    $details = [];

    foreach ($unclosed as $rec) {
        $checkInTs = strtotime($rec['check_in_time']);
        $autoOutTime = $rec['attendance_date'] . ' 19:30:00';
        $autoOutTs = strtotime($autoOutTime);

        $workMinutes = max(0, round(($autoOutTs - $checkInTs) / 60));
        $status = ($workMinutes >= 240) ? 'HALF_DAY' : 'ABSENT';
        if ($workMinutes >= 420) {
            $status = 'PRESENT';
        }

        $notes = trim(($rec['notes'] ?? '') . ' [Auto Check-Out by System Cron]');

        db_execute(
            "UPDATE attendance 
             SET check_out_time = ?, 
                 total_work_minutes = ?, 
                 final_status = ?, 
                 notes = ?, 
                 updated_at = NOW() 
             WHERE id = ?",
            [$autoOutTime, $workMinutes, $status, $notes, $rec['id']]
        );

        $count++;
        $details[] = [
            'id' => $rec['id'],
            'user' => $rec['user_name'],
            'date' => $rec['attendance_date'],
            'check_in' => $rec['check_in_time'],
            'auto_check_out' => $autoOutTime,
            'status' => $status
        ];
    }

    return [
        'name' => 'attendance_auto_checkout',
        'status' => 'success',
        'processed' => $count,
        'details' => $details
    ];
}

// ------------------------------------------------------------------------------
// Task 2: Sync Daily Attendance to Google Sheets
// ------------------------------------------------------------------------------
function cron_sync_attendance_sheets(): array {
    $today = date('Y-m-d');

    $records = db_query(
        "SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role 
         FROM attendance a 
         JOIN users u ON a.user_id = u.id 
         WHERE a.attendance_date = ? 
         ORDER BY a.check_in_time ASC",
        [$today]
    );

    $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['google_sheets_config']);
    $config = $setting ? json_decode($setting['value'], true) : [];
    $fallbackUrl = defined('GOOGLE_SHEETS_WEBHOOK_URL') ? GOOGLE_SHEETS_WEBHOOK_URL : '';
    $globalUrl = !empty($config['global_webhook_url']) ? trim($config['global_webhook_url']) : $fallbackUrl;
    $globalEnabled = !empty($config['enabled']) || (!empty($fallbackUrl));

    if (!$globalEnabled || empty($globalUrl)) {
        return [
            'name' => 'attendance_sheets_sync',
            'status' => 'skipped',
            'reason' => 'Google Sheets integration not enabled or webhook URL not configured'
        ];
    }

    $synced = 0;
    foreach ($records as $rec) {
        $event = !empty($rec['check_out_time']) ? 'CHECK_OUT' : 'CHECK_IN';
        
        $payload = [
            'timestamp' => date('Y-m-d H:i:s'),
            'sheet_type' => 'attendance',
            'tab_name' => 'Attendance',
            'event' => $event,
            'attendance_id' => $rec['id'] ?? '',
            'attendance_date' => $rec['attendance_date'] ?? $today,
            'user_id' => $rec['user_id'] ?? '',
            'employee_name' => $rec['user_name'] ?? 'Employee',
            'employee_email' => $rec['user_email'] ?? '',
            'role' => $rec['user_role'] ?? '',
            'work_mode' => strtoupper($rec['work_mode'] ?? 'OFFICE'),
            'shift' => ($rec['shift_start'] ?? '10:00:00') . ' - ' . ($rec['shift_end'] ?? '19:00:00'),
            'check_in_time' => !empty($rec['check_in_time']) ? date('h:i:s A', strtotime($rec['check_in_time'])) : '',
            'check_out_time' => !empty($rec['check_out_time']) ? date('h:i:s A', strtotime($rec['check_out_time'])) : '',
            'total_hours' => !empty($rec['total_work_minutes']) ? round($rec['total_work_minutes'] / 60, 2) : 0,
            'status' => strtoupper($rec['final_status'] ?? $rec['check_in_status'] ?? 'PRESENT'),
            'is_late' => (!empty($rec['check_in_status']) && strtolower($rec['check_in_status']) === 'late') ? 'YES' : 'NO',
            'notes' => $rec['notes'] ?? '',
            'actor_name' => 'System Cron'
        ];

        $ch = curl_init($globalUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 200 && $code < 400) {
            $synced++;
        }
    }

    return [
        'name' => 'attendance_sheets_sync',
        'status' => 'success',
        'records_found' => count($records),
        'synced_count' => $synced
    ];
}

// ------------------------------------------------------------------------------
// Task 3: Overdue Tasks Identification
// ------------------------------------------------------------------------------
function cron_check_overdue_tasks(): array {
    $now = date('Y-m-d H:i:s');
    $overdueTasks = db_query(
        "SELECT t.id, t.task_number, t.title, u.name as assignee_name, t.deadline, t.status 
         FROM tasks t 
         LEFT JOIN users u ON t.assignee_id = u.id 
         WHERE t.deadline IS NOT NULL 
           AND t.deadline < ? 
           AND t.status NOT IN ('COMPLETED', 'REJECTED')",
        [$now]
    );

    return [
        'name' => 'overdue_tasks_check',
        'status' => 'success',
        'overdue_count' => count($overdueTasks),
        'tasks' => array_slice($overdueTasks, 0, 10)
    ];
}

// ------------------------------------------------------------------------------
// Task 4: Auto-Expire Stale Candidate Offer Letters
// ------------------------------------------------------------------------------
function cron_expire_offer_letters(): array {
    $cutoff = date('Y-m-d', strtotime('-14 days'));
    
    $expired = db_execute(
        "UPDATE offer_letters 
         SET status = 'EXPIRED', updated_at = NOW() 
         WHERE status = 'SENT' AND joining_date < ?",
        [$cutoff]
    );

    return [
        'name' => 'expire_offer_letters',
        'status' => 'success',
        'expired_count' => $expired
    ];
}

// ------------------------------------------------------------------------------
// Task 5: System Hygiene & Expired Tokens Cleanup
// ------------------------------------------------------------------------------
function cron_system_cleanup(): array {
    $cleanedFiles = 0;
    $tmpDir = sys_get_temp_dir();
    $files = glob($tmpDir . '/login_attempt_*');
    if ($files) {
        $cutoff = time() - 7200;
        foreach ($files as $f) {
            if (filemtime($f) < $cutoff) {
                @unlink($f);
                $cleanedFiles++;
            }
        }
    }

    return [
        'name' => 'system_cleanup',
        'status' => 'success',
        'cleaned_temp_locks' => $cleanedFiles
    ];
}

// ------------------------------------------------------------------------------
// Execute Requested Task(s)
// ------------------------------------------------------------------------------
try {
    switch ($task) {
        case 'auto_checkout':
            $results['actions'][] = run_safe_cron_action('attendance_auto_checkout', 'cron_auto_checkout');
            break;

        case 'sync_attendance':
            $results['actions'][] = run_safe_cron_action('attendance_sheets_sync', 'cron_sync_attendance_sheets');
            break;

        case 'overdue_tasks':
            $results['actions'][] = run_safe_cron_action('overdue_tasks_check', 'cron_check_overdue_tasks');
            break;

        case 'expire_offers':
            $results['actions'][] = run_safe_cron_action('expire_offer_letters', 'cron_expire_offer_letters');
            break;

        case 'cleanup':
            $results['actions'][] = run_safe_cron_action('system_cleanup', 'cron_system_cleanup');
            break;

        case 'all':
        default:
            $results['actions'][] = run_safe_cron_action('attendance_auto_checkout', 'cron_auto_checkout');
            $results['actions'][] = run_safe_cron_action('attendance_sheets_sync', 'cron_sync_attendance_sheets');
            $results['actions'][] = run_safe_cron_action('overdue_tasks_check', 'cron_check_overdue_tasks');
            $results['actions'][] = run_safe_cron_action('expire_offer_letters', 'cron_expire_offer_letters');
            $results['actions'][] = run_safe_cron_action('system_cleanup', 'cron_system_cleanup');
            break;
    }
} catch (Throwable $e) {
    $results['success'] = false;
    $results['fatal_error'] = $e->getMessage();
}

$results['execution_time_ms'] = round((microtime(true) - $startTime) * 1000, 2);

if ($isCli) {
    echo "================================================================\n";
    echo "⏰ ASSURANCE MEDIA CRON JOBS EXECUTION REPORT (CLI)\n";
    echo "Timestamp: " . $results['timestamp'] . "\n";
    echo "Task: " . $results['task'] . "\n";
    echo "Execution Time: " . $results['execution_time_ms'] . " ms\n";
    echo "----------------------------------------------------------------\n";
    foreach ($results['actions'] as $act) {
        echo "[ACTION] " . $act['name'] . " (" . ($act['status'] ?? 'unknown') . ")\n";
        echo json_encode($act, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n\n";
    }
    echo "================================================================\n";
} else {
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
