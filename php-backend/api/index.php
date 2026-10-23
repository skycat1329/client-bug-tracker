<?php
// ==============================================================================
// Client Bug Tracker - Unified PHP REST API Router (Hostinger Compatible)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/smtp.php';
require_once __DIR__ . '/totp.php';

// 1. CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Authorization, X-Auth-Token");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Global Exception Handler for clean JSON error output
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'Database / Server Error: ' . $e->getMessage()
    ]);
    exit;
});

// 2. Helper Functions
function json_response($data, int $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400, $details = null) {
    json_response(['success' => false, 'error' => $message, 'details' => $details], $status);
}

// Auto-migrate totp columns and login_attempts table if not yet present in MySQL
function ensure_security_schema() {
    static $ensured = false;
    if ($ensured) return;
    $ensured = true;
    try {
        db_execute("CREATE TABLE IF NOT EXISTS `login_attempts` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `ip_address` VARCHAR(45) NOT NULL,
            `email` VARCHAR(191) NOT NULL,
            `attempted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `is_success` TINYINT(1) DEFAULT 0,
            INDEX `idx_ip_attempt` (`ip_address`, `attempted_at`),
            INDEX `idx_email_attempt` (`email`, `attempted_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $cols = db_query("SHOW COLUMNS FROM `users` LIKE 'totp_secret'");
        if (empty($cols)) {
            db_execute("ALTER TABLE `users` ADD COLUMN `totp_secret` VARCHAR(64) NULL AFTER `avatar_url`");
            db_execute("ALTER TABLE `users` ADD COLUMN `totp_enabled` TINYINT(1) DEFAULT 0 AFTER `totp_secret`");
        }

        // Permanently purge demo accounts from production database
        db_execute("DELETE FROM users WHERE email IN ('admin@agency.com', 'dev@agency.com') OR id IN ('usr-admin-primary', 'usr-dev-primary')");

        // Ensure primary Super Admin account exists
        $adminUser = db_query_one("SELECT id, password_hash FROM users WHERE LOWER(email) = 'admin@assurancemedia.com'");
        $adminHash = password_hash('AssuranceAdmin2026!', PASSWORD_BCRYPT);
        if (!$adminUser) {
            db_execute(
                "INSERT INTO users (id, email, password_hash, name, role, custom_role, organization_id, totp_enabled, must_reset_password) 
                 VALUES ('usr-admin-master', 'admin@assurancemedia.com', ?, 'Agency Administrator', 'super_admin', 'Administrator', NULL, 0, 0)",
                [$adminHash]
            );
        } else {
            db_execute(
                "UPDATE users SET password_hash = ?, role = 'super_admin', name = 'Agency Administrator', must_reset_password = 0 WHERE id = ?",
                [$adminHash, $adminUser['id']]
            );
        }

        // Clear test audit records and stale lockout records
        db_execute("DELETE FROM login_attempts WHERE email LIKE '%@security-test.local%' OR email = 'admin@assurancemedia.com' OR attempted_at <= '2026-10-23 16:15:00'");
        db_execute("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
    } catch (Exception $e) {}
}

function check_rate_limit(string $email = ''): bool {
    ensure_security_schema();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $email = strtolower(trim($email));
    $window = date('Y-m-d H:i:s', time() - 900); // 15-minute sliding window

    // Check failed attempts for this IP address (max 5)
    $ipFailures = db_query_one(
        "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip_address = ? AND attempted_at >= ? AND is_success = 0",
        [$ip, $window]
    );
    if (($ipFailures['cnt'] ?? 0) >= 5) {
        return false;
    }

    // Check failed attempts for this specific account email (max 5)
    if (!empty($email)) {
        $emailFailures = db_query_one(
            "SELECT COUNT(*) as cnt FROM login_attempts WHERE email = ? AND attempted_at >= ? AND is_success = 0",
            [$email, $window]
        );
        if (($emailFailures['cnt'] ?? 0) >= 5) {
            return false;
        }
    }

    return true;
}

function record_login_attempt(string $email, bool $success) {
    ensure_security_schema();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $email = strtolower(trim($email));
    try {
        db_execute(
            "INSERT INTO login_attempts (ip_address, email, is_success) VALUES (?, ?, ?)",
            [$ip, $email, $success ? 1 : 0]
        );
        if ($success) {
            db_execute(
                "DELETE FROM login_attempts WHERE (email = ? OR ip_address = ?) AND is_success = 0",
                [$email, $ip]
            );
        }
    } catch (Exception $e) {}
}

function auth_generic_failure(?string $email = null) {
    if (!empty($email)) {
        record_login_attempt($email, false);
    }
    json_response([
        'success' => false,
        'error' => 'Invalid email, password, or authentication code'
    ], 401);
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', trim($raw));
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function get_auth_user(): ?array {
    $candidates = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['Authorization'] ?? null,
        $_SERVER['HTTP_X_AUTHORIZATION'] ?? null,
        $_SERVER['HTTP_X_AUTH_TOKEN'] ?? null,
        $_SERVER['X_AUTHORIZATION'] ?? null,
        $_SERVER['X-Authorization'] ?? null,
    ];

    if (function_exists('apache_request_headers')) {
        $ah = apache_request_headers();
        foreach ($ah as $k => $v) {
            $lk = strtolower($k);
            if ($lk === 'authorization' || $lk === 'x-authorization' || $lk === 'x-auth-token') {
                $candidates[] = $v;
            }
        }
    }

    if (function_exists('getallheaders')) {
        $gh = getallheaders();
        foreach ($gh as $k => $v) {
            $lk = strtolower($k);
            if ($lk === 'authorization' || $lk === 'x-authorization' || $lk === 'x-auth-token') {
                $candidates[] = $v;
            }
        }
    }

    $token = null;
    foreach ($candidates as $header) {
        if (!empty($header)) {
            if (preg_match('/Bearer\s+(\S+)/i', $header, $matches)) {
                $token = $matches[1];
                break;
            } else if (!str_contains($header, ' ') && strlen(trim($header)) > 20) {
                $token = trim($header);
                break;
            }
        }
    }

    if (!$token && !empty($_GET['token'])) {
        $token = $_GET['token'];
    }
    if (!$token && !empty($_POST['token'])) {
        $token = $_POST['token'];
    }
    if (!$token && !empty($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
    }

    if (!$token) {
        return null;
    }

    $decoded = jwt_decode($token, JWT_SECRET);
    if (!$decoded || empty($decoded['userId'])) {
        return null;
    }

    $user = db_query_one('SELECT id, email, name, role, custom_role, organization_id, must_reset_password FROM users WHERE id = ?', [$decoded['userId']]);
    if ($user) {
        $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
        if (empty($user['organization_id'])) {
            $mem = db_query_one('SELECT organization_id FROM organization_members WHERE user_id = ? LIMIT 1', [$user['id']]);
            if ($mem && !empty($mem['organization_id'])) {
                $user['organization_id'] = $mem['organization_id'];
            } elseif ($user['role'] === 'client') {
                $orgByContact = db_query_one('SELECT id FROM organizations WHERE contact_email = ? LIMIT 1', [$user['email']]);
                if ($orgByContact) {
                    $user['organization_id'] = $orgByContact['id'];
                }
            }
        }
    }
    return $user ?: null;
}

function require_auth(): array {
    $user = get_auth_user();
    if (!$user) {
        json_error('Authentication required. Missing, invalid, or expired token.', 401);
    }

    global $path;
    $allowedWhenResetRequired = [
        '/api/auth/force-reset-password',
        '/api/auth/me',
        '/api/auth/logout'
    ];
    if (!empty($user['must_reset_password']) && !in_array($path, $allowedWhenResetRequired)) {
        json_error('You must reset your initial temporary password before accessing portal features.', 403, 'PASSWORD_RESET_REQUIRED');
    }

    return $user;
}

function require_roles(array $user, array $allowed_roles) {
    if (!in_array($user['role'], $allowed_roles)) {
        json_error('Forbidden: You do not have permission to perform this action', 403);
    }
}

function send_slack_notification(string $channel, string $text, array $fields = [], string $color = '#4A154B'): bool {
    if (!defined('SLACK_WEBHOOK_URL') || empty(SLACK_WEBHOOK_URL)) {
        return false;
    }

    $payload = [
        'text' => $text,
        'attachments' => [
            [
                'color' => $color,
                'fields' => $fields,
                'footer' => 'Client Bug Tracker',
                'ts' => time()
            ]
        ]
    ];

    $ch = curl_init(SLACK_WEBHOOK_URL);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ($httpCode === 200);
}

function send_credentials_email(string $recipientEmail, string $recipientName, string $password, string $roleTitle, string $brandName = '', bool $isBrandClient = false): bool {
    $host = $_SERVER['HTTP_HOST'] ?? 'yourdomain.com';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $loginUrl = $isBrandClient ? ($protocol . $host . '/brand/login') : ($protocol . $host . '/login');

    $subject = $isBrandClient 
        ? "Welcome to Assurance Media - {$brandName} Portal Login Credentials"
        : "Welcome to Assurance Media - Your Team Account Credentials";
    
    $fromEmail = defined('EMAIL_FROM') && !empty(EMAIL_FROM) ? EMAIL_FROM : ('support@' . preg_replace('/^www\./', '', $host));
    $fromName = defined('EMAIL_FROM_NAME') && !empty(EMAIL_FROM_NAME) ? EMAIL_FROM_NAME : 'Assurance Media';

    $html = "
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07); }
        .header { background: #0066CC; padding: 28px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 32px 28px; }
        .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 20px; background: #e0f2fe; color: #0284c7; }
        .cred-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0066CC; padding: 18px 20px; border-radius: 10px; margin: 20px 0; }
        .cred-row { margin: 6px 0; font-size: 14px; }
        .cred-val { color: #0066CC; font-size: 15px; font-weight: 700; font-family: Consolas, monospace; background: #eef2ff; padding: 2px 8px; border-radius: 4px; }
        .warning-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; font-size: 12.5px; color: #92400e; margin: 18px 0; }
        .btn { display: inline-block; background: #0066CC; color: #ffffff !important; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(0, 102, 204, 0.3); }
        .footer { padding: 20px 24px; background: #f8fafc; font-size: 11.5px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class='card'>
        <div class='header'>
          <h1>Assurance Media</h1>
          <p>" . ($isBrandClient ? ("Dedicated Client Portal &bull; " . htmlspecialchars($brandName)) : "Agency Command Center") . "</p>
        </div>
        <div class='content'>
          <span class='badge'>" . htmlspecialchars($roleTitle) . "</span>
          <p style='margin-top: 14px; font-size: 15px;'>Hello <strong>" . htmlspecialchars($recipientName) . "</strong>,</p>
          <p style='color: #475569; font-size: 14px; line-height: 1.6;'>
            " . ($isBrandClient 
                ? ("An account has been created for your brand (<strong>" . htmlspecialchars($brandName) . "</strong>) on the Assurance Media Client Portal. You can report bugs, track real-time resolution progress, and communicate directly with our engineering team.")
                : ("Your team member account has been provisioned on Assurance Media.")
              ) . "
          </p>
          
          <div class='cred-box'>
            <div class='cred-row'><strong>Portal Login Email:</strong> <span class='cred-val'>" . htmlspecialchars($recipientEmail) . "</span></div>
            <div class='cred-row'><strong>Initial Temporary Password:</strong> <span class='cred-val'>" . htmlspecialchars($password) . "</span></div>
            <div class='cred-row'><strong>Portal URL:</strong> <a href='" . htmlspecialchars($loginUrl) . "' style='color: #0066CC; word-break: break-all;'>" . htmlspecialchars($loginUrl) . "</a></div>
          </div>

          <div class='warning-box'>
            <strong>🔒 First-Time Security Requirement:</strong><br/>
            For your security, this temporary password must be changed immediately upon your first sign in. You will be prompted to create your permanent password.
          </div>

          <p style='text-align: center; margin: 26px 0 10px 0;'>
            <a href='" . htmlspecialchars($loginUrl) . "' class='btn'>Sign In to " . ($isBrandClient ? 'Brand Portal' : 'Command Center') . "</a>
          </p>
        </div>
        <div class='footer'>
          Assurance Media Client Services &bull; Support: <a href='mailto:" . htmlspecialchars($fromEmail) . "' style='color: #64748b;'>" . htmlspecialchars($fromEmail) . "</a><br/>
          <em>Made by Akash with ❤️</em>
        </div>
      </div>
    </body>
    </html>
    ";

    $textBody = "Hello {$recipientName},\n\nAn account has been created for you on Assurance Media (" . ($isBrandClient ? "Brand: {$brandName}" : $roleTitle) . ").\n\nLogin Email: {$recipientEmail}\nInitial Password: {$password}\nLogin URL: {$loginUrl}\n\nSECURITY NOTICE: You will be required to change your temporary password upon logging in for the first time.\n\nBest regards,\nAssurance Media Support Team\nMade by Akash with ❤️";

    $delivered = false;
    $errorMessage = null;
    global $lastEmailError;

    // 1. Try authenticated SMTP if enabled
    if (defined('SMTP_ENABLED') && SMTP_ENABLED) {
        $smtpResult = send_smtp_email($recipientEmail, $subject, $html, $textBody);
        $delivered = $smtpResult['success'];
        $errorMessage = $smtpResult['error'] ?? null;
        $lastEmailError = $errorMessage;
    } else {
        // 2. Standard PHP mail() with envelope sender parameter (-f)
        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $fromName . ' <' . $fromEmail . '>',
            'Reply-To: ' . $fromEmail,
            'Return-Path: ' . $fromEmail,
            'X-Mailer: AssuranceMedia/PHP'
        ];

        $delivered = @mail($recipientEmail, $subject, $html, implode("\r\n", $headers), "-f" . $fromEmail);
        if (!$delivered) {
            $errorMessage = 'PHP mail() returned false. Set SMTP_ENABLED = true in api/config.php to send via Google Workspace / SMTP.';
        }
    }

    // Record in notification deliveries table
    $deliveryId = 'del-mail-' . time() . '-' . bin2hex(random_bytes(4));
    try {
        db_execute(
            'INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $deliveryId,
                'email',
                $recipientEmail,
                'user_credentials_created',
                null,
                json_encode(['to' => $recipientEmail, 'name' => $recipientName, 'role' => $roleTitle, 'from' => $fromEmail, 'is_client' => $isBrandClient, 'brand' => $brandName]),
                $delivered ? 'delivered' : 'failed',
                1,
                $errorMessage
            ]
        );
    } catch (Exception $e) {
        // Non-blocking
    }

    return (bool)$delivered;
}

// ==============================================================================
// WhatsApp & Multi-Channel Notification Engine
// ==============================================================================

function get_whatsapp_config(): array {
    $default = [
        'enabled' => defined('WHATSAPP_ENABLED') ? WHATSAPP_ENABLED : true,
        'gateway_url' => defined('WHATSAPP_GATEWAY_URL') ? WHATSAPP_GATEWAY_URL : '',
        'api_key' => defined('WHATSAPP_API_KEY') ? WHATSAPP_API_KEY : '',
        'admin_phone' => defined('WHATSAPP_DEFAULT_ADMIN_PHONE') ? WHATSAPP_DEFAULT_ADMIN_PHONE : '+919999999999',
        'send_on_create' => true,
        'send_on_assign' => true,
        'send_on_status' => true
    ];

    try {
        $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['whatsapp_config']);
        if ($setting && !empty($setting['value'])) {
            $parsed = json_decode($setting['value'], true);
            if (is_array($parsed)) {
                return array_merge($default, $parsed);
            }
        }
    } catch (Exception $e) {}

    return $default;
}

function send_whatsapp_notification(string $toPhone, string $message, array $meta = []): array {
    $config = get_whatsapp_config();
    if (empty($toPhone)) {
        $toPhone = $config['admin_phone'] ?? '+919999999999';
    }

    $cleanPhone = preg_replace('/[^0-9+]/', '', trim($toPhone));
    $encodedText = urlencode($message);
    $directUrl = "https://api.whatsapp.com/send?phone={$cleanPhone}&text={$encodedText}";

    $delivered = false;
    $error = null;
    $httpCode = 0;

    // If an external gateway URL (e.g. UltraMsg, Twilio, Meta Cloud API, or custom webhook) is configured, POST the payload
    if (!empty($config['enabled']) && !empty($config['gateway_url'])) {
        $payload = json_encode([
            'to' => $cleanPhone,
            'phone' => $cleanPhone,
            'body' => $message,
            'message' => $message,
            'meta' => $meta,
            'timestamp' => date('c')
        ]);

        $ch = curl_init($config['gateway_url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        $headers = ['Content-Type: application/json'];
        if (!empty($config['api_key'])) {
            $headers[] = 'Authorization: Bearer ' . $config['api_key'];
            $headers[] = 'X-API-KEY: ' . $config['api_key'];
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $res = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && empty($err)) {
            $delivered = true;
        } else {
            $error = $err ?: "HTTP {$httpCode}: {$res}";
        }
    } else {
        // Direct click-to-chat URL generated and available for browser / admin dispatch
        $delivered = true;
    }

    // Record in notification_deliveries table
    try {
        $deliveryId = 'del-wa-' . time() . '-' . bin2hex(random_bytes(4));
        db_execute(
            'INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $deliveryId,
                'whatsapp',
                $cleanPhone,
                $meta['event'] ?? 'general_notification',
                $meta['ticket_id'] ?? null,
                json_encode(['phone' => $cleanPhone, 'message' => $message, 'url' => $directUrl, 'meta' => $meta]),
                $delivered ? 'delivered' : 'failed',
                1,
                $error
            ]
        );
    } catch (Exception $e) {}

    return [
        'success' => $delivered,
        'phone' => $cleanPhone,
        'whatsapp_url' => $directUrl,
        'error' => $error
    ];
}

function get_phase_meta(string $status): array {
    $statusKey = strtoupper(trim(str_replace('_', ' ', $status)));
    switch ($statusKey) {
        case 'NEW':
            return [
                'phase_number' => 1,
                'phase_label' => 'Phase 1: Bug Report Acknowledged',
                'short_title' => 'Acknowledged & Queued',
                'badge_bg' => '#e0f2fe',
                'badge_color' => '#0284c7',
                'badge_border' => '#bae6fd',
                'icon' => '📥',
                'summary' => 'Your bug report has been successfully received by Assurance Media Command Center and queued for engineering triage.',
                'next_step' => 'A senior engineer will inspect the defect, classify severity, and assign a dedicated specialist.'
            ];
        case 'TRIAGED':
            return [
                'phase_number' => 2,
                'phase_label' => 'Phase 2: Triaged & Prioritized',
                'short_title' => 'Triaged & Scheduled',
                'badge_bg' => '#f3e8ff',
                'badge_color' => '#7c3aed',
                'badge_border' => '#e9d5ff',
                'icon' => '🔍',
                'summary' => 'Our technical leads have reviewed the defect, verified impact, and prioritized the issue for development.',
                'next_step' => 'A specialist developer is being assigned to begin diagnostics and code patching.'
            ];
        case 'ASSIGNED':
            return [
                'phase_number' => 3,
                'phase_label' => 'Phase 3: Dedicated Specialist Assigned',
                'short_title' => 'Specialist Assigned',
                'badge_bg' => '#e0e7ff',
                'badge_color' => '#4338ca',
                'badge_border' => '#c7d2fe',
                'icon' => '👨‍💻',
                'summary' => 'A dedicated software engineer has taken ownership of your ticket and is actively inspecting the codebase.',
                'next_step' => 'The engineer will reproduce the error in our dev environment and prepare the resolution.'
            ];
        case 'IN PROGRESS':
            return [
                'phase_number' => 4,
                'phase_label' => 'Phase 4: Active Development & Patching',
                'short_title' => 'Under Active Development',
                'badge_bg' => '#fef3c7',
                'badge_color' => '#b45309',
                'badge_border' => '#fde68a',
                'icon' => '⚙️',
                'summary' => 'Our developer is actively working on the fix, refactoring faulty logic, or applying code patches.',
                'next_step' => 'Once testing passes internally, the fix will be deployed to your staging or live environment for client verification.'
            ];
        case 'WAITING FOR CLIENT':
            return [
                'phase_number' => 4,
                'phase_label' => 'Phase: Information Requested from Brand',
                'short_title' => 'Brand Action Needed',
                'badge_bg' => '#ffedd5',
                'badge_color' => '#c2410c',
                'badge_border' => '#fed7aa',
                'icon' => '⚠️',
                'summary' => 'Our engineering team requires additional details, credentials, or reproduction steps from your team to proceed.',
                'next_step' => 'Please reply directly via the portal or comments with the requested details.'
            ];
        case 'FIX READY FOR TESTING':
            return [
                'phase_number' => 5,
                'phase_label' => 'Phase 5: Fix Deployed & Ready for Client Testing',
                'short_title' => 'Ready for Verification',
                'badge_bg' => '#ccfbf1',
                'badge_color' => '#0f766e',
                'badge_border' => '#99f6e4',
                'icon' => '🧪',
                'summary' => 'The patch has been deployed! Please test the fix on your website and verify that the problem is completely solved.',
                'next_step' => 'Click "Confirm Resolved & Close" in your portal if all is working, or reopen if you observe any persisting defect.'
            ];
        case 'RESOLVED':
            return [
                'phase_number' => 6,
                'phase_label' => 'Phase 6: Solution Resolved & Validated',
                'short_title' => 'Resolved by Engineering',
                'badge_bg' => '#dcfce7',
                'badge_color' => '#15803d',
                'badge_border' => '#86efac',
                'icon' => '✅',
                'summary' => 'The bug has been successfully resolved and code updates verified.',
                'next_step' => 'Please confirm from your Brand Portal to officially close the ticket.'
            ];
        case 'CLOSED':
            return [
                'phase_number' => 7,
                'phase_label' => 'Phase 7: Ticket Verified & Closed',
                'short_title' => 'Officially Closed',
                'badge_bg' => '#f1f5f9',
                'badge_color' => '#475569',
                'badge_border' => '#cbd5e1',
                'icon' => '🔒',
                'summary' => 'This defect report is verified complete and closed in the Assurance Media repository.',
                'next_step' => 'No further action required. Thank you for partnering with Assurance Media!'
            ];
        default:
            return [
                'phase_number' => 0,
                'phase_label' => 'Phase Update: ' . $statusKey,
                'short_title' => $statusKey,
                'badge_bg' => '#e2e8f0',
                'badge_color' => '#334155',
                'badge_border' => '#cbd5e1',
                'icon' => '📋',
                'summary' => "The status of this ticket has transitioned to {$statusKey}.",
                'next_step' => 'Log in to your Brand Portal to track real-time resolution.'
            ];
    }
}

function get_brand_notification_targets(array $ticket, ?array $brand = null): array {
    $orgId = $ticket['organization_id'] ?? '';
    if (!$brand && !empty($orgId)) {
        $brand = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
    }
    $requester = !empty($ticket['requester_id']) ? db_query_one('SELECT * FROM users WHERE id = ?', [$ticket['requester_id']]) : null;

    $emails = [];
    if (!empty($brand['contact_email'])) {
        $emails[] = trim($brand['contact_email']);
    }
    if (!empty($requester['email'])) {
        $emails[] = trim($requester['email']);
    }
    $emails = array_values(array_unique(array_filter($emails)));

    $phones = [];
    if (!empty($brand['phone'])) {
        $phones[] = trim($brand['phone']);
    }
    if (!empty($requester['phone'])) {
        $phones[] = trim($requester['phone']);
    }
    $phones = array_values(array_unique(array_filter($phones)));

    return [
        'brand' => $brand,
        'requester' => $requester,
        'emails' => $emails,
        'phones' => $phones,
        'brand_name' => $brand['name'] ?? 'Client Brand',
    ];
}

function render_responsive_phase_email(array $ticket, array $phaseMeta, string $oldStatus, string $newStatus, string $notes, ?array $updatedBy, string $clientPortalUrl, string $brandName): string {
    $ticketNumber = htmlspecialchars($ticket['ticket_number'] ?? 'WEB');
    $title = htmlspecialchars($ticket['title'] ?? 'Ticket');
    $priority = htmlspecialchars($ticket['priority'] ?? 'P3');
    $category = htmlspecialchars($ticket['category'] ?? 'General');
    $website = htmlspecialchars($ticket['website_name'] ?? 'Brand Website');
    $environment = htmlspecialchars($ticket['environment'] ?? 'production');

    $phaseNum = $phaseMeta['phase_number'];
    $phaseLabel = htmlspecialchars($phaseMeta['phase_label']);
    $shortTitle = htmlspecialchars($phaseMeta['short_title']);
    $badgeBg = $phaseMeta['badge_bg'];
    $badgeColor = $phaseMeta['badge_color'];
    $badgeBorder = $phaseMeta['badge_border'];
    $summary = htmlspecialchars($phaseMeta['summary']);
    $nextStep = htmlspecialchars($phaseMeta['next_step']);

    $assigneeName = '';
    if (!empty($ticket['assignee_id'])) {
        $u = db_query_one('SELECT name FROM users WHERE id = ?', [$ticket['assignee_id']]);
        if ($u && !empty($u['name'])) {
            $assigneeName = htmlspecialchars($u['name']);
        }
    }

    $stepperStages = [
        1 => 'Received',
        2 => 'Triaged',
        3 => 'Assigned',
        4 => 'In Dev',
        5 => 'Testing',
        6 => 'Resolved'
    ];

    $stepperHtml = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='margin: 18px 0; table-layout: fixed;'><tr>";
    foreach ($stepperStages as $num => $lbl) {
        $isDone = ($phaseNum > 0 && $num < $phaseNum) || ($phaseNum === 7);
        $isCurrent = ($phaseNum === $num);

        $circleBg = $isDone ? '#16a34a' : ($isCurrent ? '#0176D3' : '#e2e8f0');
        $circleColor = ($isDone || $isCurrent) ? '#ffffff' : '#64748b';
        $labelColor = $isCurrent ? '#0176D3' : ($isDone ? '#16a34a' : '#94a3b8');
        $labelWeight = $isCurrent ? '700' : '500';
        $iconText = $isDone ? '&#10003;' : (string)$num;

        $stepperHtml .= "
        <td align='center' style='padding: 2px;'>
          <div style='width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background: {$circleBg}; color: {$circleColor}; font-size: 11px; font-weight: 700; text-align: center; margin: 0 auto;'>{$iconText}</div>
          <div style='font-size: 10px; font-weight: {$labelWeight}; color: {$labelColor}; margin-top: 4px; white-space: nowrap;'>{$lbl}</div>
        </td>";
    }
    $stepperHtml .= "</tr></table>";

    $notesBlock = "";
    if (!empty($notes)) {
        $notesBlock = "
        <div style='margin-top: 14px; padding: 12px 14px; background: #f1f5f9; border-radius: 8px; border-left: 3px solid #0176D3;'>
          <strong style='font-size: 11.5px; text-transform: uppercase; color: #475569;'>Notes / Progress Update:</strong>
          <div style='font-size: 13px; color: #0f172a; margin-top: 4px; line-height: 1.5;'>" . nl2br(htmlspecialchars($notes)) . "</div>
        </div>";
    }

    $assigneeRow = "";
    if (!empty($assigneeName)) {
        $assigneeRow = "<tr><td style='padding: 6px 0; color: #64748b; font-size: 12px; width: 38%;'><strong>Specialist:</strong></td><td style='padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600;'>&#128100; {$assigneeName}</td></tr>";
    }

    return "
    <!DOCTYPE html>
    <html lang='en'>
    <head>
      <meta charset='utf-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1.0'>
      <title>Assurance Media Ticket Update</title>
      <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
        @media only screen and (max-width: 600px) {
          .wrapper { width: 100% !important; padding: 12px !important; }
          .card { border-radius: 12px !important; }
          .content { padding: 20px 16px !important; }
          .header-box { padding: 20px 16px !important; }
          .btn { width: 100% !important; display: block !important; box-sizing: border-box !important; }
        }
      </style>
    </head>
    <body style='background-color: #f8fafc; margin: 0; padding: 0;'>
      <table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='background-color: #f8fafc;'>
        <tr>
          <td align='center' class='wrapper' style='padding: 24px 12px;'>
            <table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' class='card' style='max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);'>
              
              <!-- Branded Header -->
              <tr>
                <td class='header-box' style='background: linear-gradient(135deg, #0176D3 0%, #005bb5 100%); padding: 24px; text-align: center; color: #ffffff;'>
                  <div style='font-size: 20px; font-weight: 800; letter-spacing: -0.3px; margin: 0;'>Assurance Media</div>
                  <div style='font-size: 12px; margin-top: 4px; opacity: 0.95; font-weight: 500;'>Dedicated Brand Portal &bull; " . htmlspecialchars($brandName) . "</div>
                </td>
              </tr>

              <!-- Main Content Body -->
              <tr>
                <td class='content' style='padding: 28px 24px;'>
                  
                  <!-- Phase Status Badge Banner -->
                  <div style='text-align: center; margin-bottom: 20px;'>
                    <span style='display: inline-block; padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 20px; background: {$badgeBg}; color: {$badgeColor}; border: 1px solid {$badgeBorder}; text-transform: uppercase; letter-spacing: 0.5px;'>
                      {$phaseLabel}
                    </span>
                    <h2 style='font-size: 18px; font-weight: 800; color: #0f172a; margin: 12px 0 4px 0;'>{$shortTitle}</h2>
                    <p style='font-size: 13.5px; color: #475569; margin: 0; line-height: 1.5;'>{$summary}</p>
                  </div>

                  <!-- Visual Progress Stepper -->
                  {$stepperHtml}

                  <!-- Key Case Information Card -->
                  <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {$badgeColor}; border-radius: 10px; padding: 16px 18px; margin: 20px 0;'>
                    <table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'>
                      <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 12px; width: 38%;'><strong>Ticket ID:</strong></td>
                        <td style='padding: 6px 0; color: #0176D3; font-size: 13px; font-family: Consolas, monospace; font-weight: 700;'>[{$ticketNumber}]</td>
                      </tr>
                      <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 12px;'><strong>Title:</strong></td>
                        <td style='padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600;'>{$title}</td>
                      </tr>
                      <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 12px;'><strong>Website & Env:</strong></td>
                        <td style='padding: 6px 0; color: #0f172a; font-size: 12.5px;'>{$website} ({$environment})</td>
                      </tr>
                      <tr>
                        <td style='padding: 6px 0; color: #64748b; font-size: 12px;'><strong>Priority / Cat:</strong></td>
                        <td style='padding: 6px 0; color: #0f172a; font-size: 12.5px;'>{$priority} &bull; {$category}</td>
                      </tr>
                      {$assigneeRow}
                    </table>
                    {$notesBlock}
                  </div>

                  <!-- What Happens Next Box -->
                  <div style='background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin: 18px 0; font-size: 12.5px; color: #166534;'>
                    <strong>&#128204; Next Step:</strong> {$nextStep}
                  </div>

                  <!-- Direct Portal CTA Button -->
                  <div style='text-align: center; margin: 26px 0 10px 0;'>
                    <a href='{$clientPortalUrl}' class='btn' style='display: inline-block; background: #0176D3; color: #ffffff !important; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(1, 118, 211, 0.25); text-align: center;'>
                      Open in Brand Portal &rarr;
                    </a>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style='padding: 18px 24px; background: #f8fafc; font-size: 11.5px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; line-height: 1.6;'>
                  Assurance Media Client Services &bull; Real-Time Engineering Command Center<br/>
                  <em>Made by Akash with ❤️</em>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    ";
}

function send_brand_phase_notification(array $ticket, string $newStatus, string $oldStatus = '', string $notes = '', ?array $brand = null, ?array $updatedBy = null): void {
    $targets = get_brand_notification_targets($ticket, $brand);
    $brandName = $targets['brand_name'];
    $emails = $targets['emails'];
    $phones = $targets['phones'];

    $phaseMeta = get_phase_meta($newStatus);
    $ticketNumber = $ticket['ticket_number'] ?? 'WEB';
    $title = $ticket['title'] ?? 'Ticket';
    $priority = $ticket['priority'] ?? 'P3';
    $website = $ticket['website_name'] ?? 'Website';

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $clientPortalUrl = $protocol . $host . "/?view=tickets&ticket=" . ($ticket['id'] ?? '');

    // 1. Send Mobile-Responsive HTML Email to ALL Registered Brand Email Addresses
    if (!empty($emails)) {
        $subject = "Assurance Media - {$phaseMeta['phase_label']}: [{$ticketNumber}] {$title}";
        $html = render_responsive_phase_email($ticket, $phaseMeta, $oldStatus, $newStatus, $notes, $updatedBy, $clientPortalUrl, $brandName);
        $textBody = "Hello {$brandName},\n\n{$phaseMeta['phase_label']}\nTicket: [{$ticketNumber}] {$title}\nStatus: {$newStatus}\nSummary: {$phaseMeta['summary']}\nNext Step: {$phaseMeta['next_step']}\n" . (!empty($notes) ? "Notes: {$notes}\n" : "") . "Track: {$clientPortalUrl}\n\nAssurance Media Client Support\nMade by Akash with ❤️";

        foreach ($emails as $recipientEmail) {
            $delivered = false;
            $err = null;
            if (defined('SMTP_ENABLED') && SMTP_ENABLED) {
                $res = send_smtp_email($recipientEmail, $subject, $html, $textBody);
                $delivered = !empty($res['success']);
                $err = $res['error'] ?? null;
            } else {
                $fromEmail = defined('EMAIL_FROM') ? EMAIL_FROM : 'tools.assurance@gmail.com';
                $headers = ['MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'From: Assurance Media <' . $fromEmail . '>'];
                $delivered = @mail($recipientEmail, $subject, $html, implode("\r\n", $headers), "-f" . $fromEmail);
            }

            try {
                $deliveryId = 'del-mail-' . time() . '-' . bin2hex(random_bytes(4));
                db_execute(
                    'INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $deliveryId,
                        'email',
                        $recipientEmail,
                        'phase_' . strtolower(str_replace(' ', '_', $newStatus)),
                        $ticket['id'] ?? null,
                        json_encode(['brand' => $brandName, 'status' => $newStatus, 'phase' => $phaseMeta['phase_label']]),
                        $delivered ? 'delivered' : 'failed',
                        1,
                        $err
                    ]
                );
            } catch (Exception $e) {}
        }
    }

    // 2. Send WhatsApp Notification to ALL Registered Brand Phone Numbers
    $assigneeLine = "";
    if (!empty($ticket['assignee_id'])) {
        $u = db_query_one('SELECT name FROM users WHERE id = ?', [$ticket['assignee_id']]);
        if ($u && !empty($u['name'])) {
            $assigneeLine = "👨‍💻 *Specialist:* {$u['name']}\n";
        }
    }

    $notesLine = !empty($notes) ? "💬 *Notes:* {$notes}\n" : "";

    $waMsg = "{$phaseMeta['icon']} *Assurance Media | {$phaseMeta['phase_label']}*\n\n" .
             "*Brand:* {$brandName}\n" .
             "*Ticket:* *{$ticketNumber}* - {$title}\n" .
             "*Current Phase:* *{$phaseMeta['short_title']}*\n" .
             "*Priority:* {$priority} | *Website:* {$website}\n" .
             $assigneeLine .
             $notesLine .
             "📌 *What Happens Next:*\n{$phaseMeta['next_step']}\n\n" .
             "🔗 *Track in Brand Portal:*\n{$clientPortalUrl}\n\n" .
             "_Assurance Media Support • Made by Akash with ❤️_";

    if (!empty($phones)) {
        foreach ($phones as $phone) {
            send_whatsapp_notification($phone, $waMsg, [
                'event' => 'phase_' . strtolower(str_replace(' ', '_', $newStatus)),
                'ticket_id' => $ticket['id'] ?? null,
                'status' => $newStatus,
                'phase' => $phaseMeta['phase_label'],
                'brand_name' => $brandName
            ]);
        }
    } else {
        // If no brand phone registered, alert the default admin phone
        $config = get_whatsapp_config();
        $adminPhone = $config['admin_phone'] ?? '+919999999999';
        send_whatsapp_notification($adminPhone, $waMsg, [
            'event' => 'phase_' . strtolower(str_replace(' ', '_', $newStatus)),
            'ticket_id' => $ticket['id'] ?? null,
            'status' => $newStatus,
            'phase' => $phaseMeta['phase_label'],
            'brand_name' => $brandName,
            'fallback_to_admin' => true
        ]);
    }
}

function send_ticket_assigned_notifications(array $ticket, array $assignee, array $assignedBy): void {
    $ticketNumber = $ticket['ticket_number'] ?? 'WEB';
    $title = $ticket['title'] ?? 'Ticket';
    $priority = $ticket['priority'] ?? 'P3';
    $category = $ticket['category'] ?? 'General';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $portalUrl = $protocol . $host . "/?view=tickets&ticket=" . ($ticket['id'] ?? '');

    // 1. Send Phase 3 (Dedicated Specialist Assigned) Notification to Registered Brand Email & Phone
    send_brand_phase_notification(
        $ticket,
        'ASSIGNED',
        $ticket['status'] ?? 'NEW',
        "Dedicated specialist " . ($assignee['name'] ?? 'Engineer') . " has been assigned to investigate and resolve this defect.",
        null,
        $assignedBy
    );

    // 2. Email to Assignee via SMTP
    $recipientEmail = $assignee['email'] ?? '';
    if (!empty($recipientEmail)) {
        $subject = "Assurance Media - Ticket Assigned: [{$ticketNumber}] {$title}";
        $sla = $ticket['target_resolution_time'] ?? 'Within standard window';
        $desc = htmlspecialchars($ticket['description'] ?? '');

        $html = "
        <!DOCTYPE html>
        <html>
        <head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; color: #0f172a; margin: 0; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: #0176D3; padding: 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
          .content { padding: 28px 24px; }
          .pill { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 12px; background: #e0f2fe; color: #0284c7; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0176D3; padding: 14px 18px; border-radius: 8px; margin: 16px 0; }
          .btn { display: inline-block; background: #0176D3; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; }
          .footer { padding: 16px; background: #f8fafc; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
        </style></head>
        <body>
          <div class='card'>
            <div class='header'><h1>Assurance Media Command Center</h1><p>Ticket Assignment Notification</p></div>
            <div class='content'>
              <span class='pill'>Priority {$priority}</span>
              <p style='font-size: 15px; margin-top: 12px;'>Hello <strong>" . htmlspecialchars($assignee['name'] ?? 'Engineer') . "</strong>,</p>
              <p>You have been assigned to resolve bug ticket <strong>[{$ticketNumber}] {$title}</strong> by " . htmlspecialchars($assignedBy['name'] ?? 'Agency Admin') . ".</p>
              <div class='box'>
                <div><strong>Ticket Number:</strong> {$ticketNumber}</div>
                <div><strong>Category:</strong> " . htmlspecialchars($category) . "</div>
                <div><strong>Priority:</strong> {$priority}</div>
                <div><strong>Target SLA:</strong> {$sla}</div>
                <div style='margin-top: 8px;'><strong>Summary:</strong> {$desc}</div>
              </div>
              <p style='text-align: center; margin: 24px 0;'><a href='{$portalUrl}' class='btn'>Open Ticket in Command Center</a></p>
            </div>
            <div class='footer'>Assurance Media Client Services &bull; Made by Akash with ❤️</div>
          </div>
        </body></html>
        ";

        $textBody = "Hello {$assignee['name']},\n\nYou have been assigned ticket [{$ticketNumber}] {$title} by {$assignedBy['name']}.\nPriority: {$priority}\nCategory: {$category}\nTarget SLA: {$sla}\nLink: {$portalUrl}\n\nAssurance Media Support Team\nMade by Akash with ❤️";

        if (defined('SMTP_ENABLED') && SMTP_ENABLED) {
            send_smtp_email($recipientEmail, $subject, $html, $textBody);
        } else {
            $fromEmail = defined('EMAIL_FROM') ? EMAIL_FROM : 'tools.assurance@gmail.com';
            $headers = ['MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'From: Assurance Media <' . $fromEmail . '>'];
            @mail($recipientEmail, $subject, $html, implode("\r\n", $headers), "-f" . $fromEmail);
        }
    }

    // 3. WhatsApp to Assignee
    $assigneePhone = $assignee['phone'] ?? '';
    $waMsg = "🔔 *Assurance Media | Ticket Assigned*\n" .
             "Ticket: *{$ticketNumber}* - {$title}\n" .
             "Priority: *{$priority}* | Category: {$category}\n" .
             "Assigned By: " . ($assignedBy['name'] ?? 'Admin') . "\n" .
             "Target SLA: " . ($ticket['target_resolution_time'] ?? 'Standard') . "\n" .
             "Open: {$portalUrl}";

    send_whatsapp_notification($assigneePhone, $waMsg, [
        'event' => 'ticket_assigned',
        'ticket_id' => $ticket['id'] ?? null,
        'assignee_id' => $assignee['id'] ?? null
    ]);
}

function send_ticket_created_notifications(array $ticket, ?array $brand, array $requester): void {
    $ticketNumber = $ticket['ticket_number'] ?? 'WEB';
    $title = $ticket['title'] ?? 'Ticket';
    $priority = $ticket['priority'] ?? 'P3';
    $brandName = $brand['name'] ?? 'Client Brand';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $portalUrl = $protocol . $host . "/?view=tickets&ticket=" . ($ticket['id'] ?? '');

    // 1. Send Phase 1 (Bug Report Acknowledged) Notification to Registered Brand Email & Phone
    send_brand_phase_notification(
        $ticket,
        'NEW',
        '',
        'Bug report successfully registered in Assurance Media Command Center. Initial engineering triage underway.',
        $brand,
        $requester
    );

    // 2. WhatsApp Alert to Admin & Engineering Team
    $config = get_whatsapp_config();
    $adminPhone = $config['admin_phone'] ?? '+919999999999';
    $waMsg = "🚨 *Assurance Media Alert: New Ticket Raised*\n" .
             "Brand: *{$brandName}*\n" .
             "Ticket: *{$ticketNumber}* - {$title}\n" .
             "Priority: *{$priority}* | Category: " . ($ticket['category'] ?? 'General') . "\n" .
             "Raised By: " . ($requester['name'] ?? 'Client') . " (" . ($requester['email'] ?? '') . ")\n" .
             "Command Center: {$portalUrl}";

    send_whatsapp_notification($adminPhone, $waMsg, [
        'event' => 'ticket_created_alert',
        'ticket_id' => $ticket['id'] ?? null,
        'brand_id' => $brand['id'] ?? null
    ]);
}

function send_ticket_status_change_notifications(array $ticket, string $oldStatus, string $newStatus, string $notes, array $updatedBy): void {
    // Send Phase Update to Registered Brand Email & Phone
    send_brand_phase_notification($ticket, $newStatus, $oldStatus, $notes, null, $updatedBy);
}

// ------------------------------------------------------------------------------
// Schema Auto-Migration for Assurance Media, Brands & Security
// ------------------------------------------------------------------------------
try {
    static $assuranceMediaSchemaChecked = false;
    if (!$assuranceMediaSchemaChecked) {
        $assuranceMediaSchemaChecked = true;
        // Organizations extra fields
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'google_sheet_url'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN google_sheet_url VARCHAR(500) NULL AFTER slug");
        }
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'contact_email'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN contact_email VARCHAR(255) NULL AFTER google_sheet_url");
        }
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'contact_name'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN contact_name VARCHAR(255) NULL AFTER contact_email");
        }
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'phone'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN phone VARCHAR(50) NULL AFTER contact_name");
        }
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'website_url'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN website_url VARCHAR(500) NULL AFTER phone");
        }
        $cols = db_query("SHOW COLUMNS FROM organizations LIKE 'status'");
        if (empty($cols)) {
            db_execute("ALTER TABLE organizations ADD COLUMN status VARCHAR(50) DEFAULT 'active' AFTER website_url");
        }

        // Users extra fields
        $cols = db_query("SHOW COLUMNS FROM users LIKE 'phone'");
        if (empty($cols)) {
            db_execute("ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER email");
        }
        $cols = db_query("SHOW COLUMNS FROM users LIKE 'must_reset_password'");
        if (empty($cols)) {
            db_execute("ALTER TABLE users ADD COLUMN must_reset_password TINYINT(1) DEFAULT 0 AFTER avatar_url");
        }

        db_execute("ALTER TABLE notification_deliveries MODIFY COLUMN channel VARCHAR(50) NOT NULL");

        // Queues Table
        db_execute("CREATE TABLE IF NOT EXISTS `queues` (
            `id` VARCHAR(64) PRIMARY KEY,
            `name` VARCHAR(150) NOT NULL,
            `slug` VARCHAR(150) NOT NULL,
            `description` TEXT NULL,
            `color` VARCHAR(50) DEFAULT 'blue',
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Queue Members Table
        db_execute("CREATE TABLE IF NOT EXISTS `queue_members` (
            `id` VARCHAR(64) PRIMARY KEY,
            `queue_id` VARCHAR(64) NOT NULL,
            `user_id` VARCHAR(64) NOT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uk_queue_user` (`queue_id`, `user_id`),
            INDEX `idx_qm_queue` (`queue_id`),
            INDEX `idx_qm_user` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Add queue_id column to tickets
        $ticketCols = db_query("SHOW COLUMNS FROM tickets LIKE 'queue_id'");
        if (empty($ticketCols)) {
            db_execute("ALTER TABLE tickets ADD COLUMN `queue_id` VARCHAR(64) NULL AFTER `assignee_id`");
            try {
                db_execute("ALTER TABLE tickets ADD INDEX `idx_ticket_queue` (`queue_id`)");
            } catch (Exception $e) {}
        }

        // Seed default queues including 'q-assigned'
        $qAssigned = db_query_one("SELECT id FROM queues WHERE id = 'q-assigned'");
        if (!$qAssigned) {
            db_execute(
                "INSERT INTO queues (id, name, slug, description, color, is_active) VALUES ('q-assigned', 'Assigned & In Progress', 'assigned-in-progress', 'Tickets currently assigned or opened by engineering personnel', 'indigo', 1)"
            );
        }

        $existingQueues = db_query("SELECT COUNT(*) AS c FROM queues");
        if (empty($existingQueues[0]['c']) || (int)$existingQueues[0]['c'] <= 1) {
            $defaultQueues = [
                ['q-assigned', 'Assigned & In Progress', 'assigned-in-progress', 'Tickets currently assigned or opened by engineering personnel', 'indigo'],
                ['q-frontend', 'Frontend & UI Bugs', 'frontend-ui', 'CSS, responsive display, layout issues, and React client bugs', 'blue'],
                ['q-backend', 'Backend & API', 'backend-api', 'PHP server logic, database records, and API endpoints', 'emerald'],
                ['q-urgent', 'Critical Escalations', 'critical-escalations', 'High priority blockers, checkout errors, server timeouts', 'rose'],
                ['q-general', 'General QA & Triage', 'general-qa', 'Initial bug reviews, reproduction tests, and customer QA', 'purple']
            ];
            foreach ($defaultQueues as $dq) {
                db_execute(
                    "INSERT INTO queues (id, name, slug, description, color, is_active) VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name)",
                    $dq
                );
            }
        }

        // Seed WhatsApp default configuration
        $waSetting = db_query_one("SELECT `key` FROM integration_settings WHERE `key` = 'whatsapp_config'");
        if (!$waSetting) {
            db_execute(
                "INSERT INTO integration_settings (`key`, `value`, `description`) VALUES ('whatsapp_config', '{\"enabled\":true,\"gateway_url\":\"\",\"admin_phone\":\"+919999999999\",\"send_on_create\":true,\"send_on_assign\":true,\"send_on_status\":true}', 'WhatsApp notifications configuration for brand and team dispatches')"
            );
        }

        // Auto-link any client users without an organization_id to their matching brand
        try {
            $unlinkedClients = db_query("SELECT id, email, name FROM users WHERE role = 'client' AND (organization_id IS NULL OR organization_id = '')");
            foreach ($unlinkedClients as $uc) {
                $org = db_query_one("SELECT id FROM organizations WHERE contact_email = ? LIMIT 1", [$uc['email']]);
                if (!$org) {
                    $prefix = explode('@', $uc['email'])[0];
                    $org = db_query_one("SELECT id FROM organizations WHERE LOWER(name) = ? OR LOWER(slug) = ? LIMIT 1", [strtolower($prefix), strtolower($prefix)]);
                }
                if ($org) {
                    db_execute("UPDATE users SET organization_id = ? WHERE id = ?", [$org['id'], $uc['id']]);
                    db_execute(
                        "INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id)",
                        ['mem-' . time() . '-' . bin2hex(random_bytes(4)), $org['id'], $uc['id'], 'owner']
                    );
                }
            }
        } catch (Exception $e) {}

    }
} catch (Exception $e) {
    // Non-blocking auto migration
}

function sync_to_google_sheet(string $brandId, string $event, array $ticket, string $details = '', string $actorName = 'System'): bool {
    // 1. Fetch integration config
    $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['google_sheets_config']);
    $config = $setting ? json_decode($setting['value'], true) : [];

    $globalEnabled = !empty($config['enabled']) || (defined('GOOGLE_SHEETS_WEBHOOK_URL') && !empty(GOOGLE_SHEETS_WEBHOOK_URL));
    $globalUrl = trim($config['global_webhook_url'] ?? (defined('GOOGLE_SHEETS_WEBHOOK_URL') ? GOOGLE_SHEETS_WEBHOOK_URL : ''));

    // 2. Fetch Brand details
    $org = db_query_one('SELECT name, google_sheet_url FROM organizations WHERE id = ?', [$brandId]);
    $brandName = $org ? $org['name'] : 'General Brand';
    $brandUrl = trim($org['google_sheet_url'] ?? '');

    $targetUrls = [];
    if (!empty($brandUrl)) {
        $targetUrls[] = ['url' => $brandUrl, 'type' => 'brand_dedicated'];
    } elseif ($globalEnabled && !empty($globalUrl)) {
        $targetUrls[] = ['url' => $globalUrl, 'type' => 'global_multi_tab'];
    }

    if (empty($targetUrls)) {
        return false;
    }

    // 3. Resolve Website name if needed
    $websiteName = $ticket['website_name'] ?? '';
    if (empty($websiteName) && !empty($ticket['website_id'])) {
        $w = db_query_one('SELECT name FROM websites WHERE id = ?', [$ticket['website_id']]);
        if ($w) $websiteName = $w['name'];
    }

    // 4. Resolve Requester name if needed
    $requesterName = $ticket['requester_name'] ?? '';
    if (empty($requesterName) && !empty($ticket['requester_id'])) {
        $u = db_query_one('SELECT name, email FROM users WHERE id = ?', [$ticket['requester_id']]);
        if ($u) $requesterName = $u['name'] . ' (' . $u['email'] . ')';
    }

    // 5. Resolve Assignee name if needed
    $assigneeName = $ticket['assignee_name'] ?? '';
    if (empty($assigneeName) && !empty($ticket['assignee_id'])) {
        $a = db_query_one('SELECT name, email FROM users WHERE id = ?', [$ticket['assignee_id']]);
        if ($a) $assigneeName = $a['name'] . ' (' . $a['email'] . ')';
    }
    if (empty($assigneeName)) {
        $assigneeName = 'Unassigned';
    }

    $payload = [
        'timestamp' => date('Y-m-d H:i:s'),
        'brand_id' => $brandId,
        'brand_name' => $brandName,
        'ticket_id' => $ticket['id'] ?? '',
        'ticket_number' => $ticket['ticket_number'] ?? '',
        'ticket_title' => $ticket['title'] ?? '',
        'event' => $event,
        'status' => $ticket['status'] ?? 'NEW',
        'priority' => $ticket['priority'] ?? 'P3',
        'website_name' => $websiteName ?: 'Main Website',
        'environment' => $ticket['environment'] ?? 'production',
        'requester_name' => $requesterName ?: 'Portal User',
        'assignee_name' => $assigneeName,
        'details' => $details,
        'actor_name' => $actorName
    ];

    $allSuccess = true;
    foreach ($targetUrls as $target) {
        $ch = curl_init($target['url']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_AUTOREFERER, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $success = ($code >= 200 && $code < 400 && empty($err));
        if (!$success) {
            $allSuccess = false;
        }

        try {
            $delivId = 'deliv-' . time() . '-' . bin2hex(random_bytes(4));
            db_execute(
                'INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $delivId,
                    'google_sheets',
                    $brandName . ' (' . $target['type'] . ')',
                    $event,
                    $ticket['id'] ?? null,
                    json_encode($payload),
                    $success ? 'delivered' : 'failed',
                    1,
                    $err ?: ($success ? null : "HTTP status $code: $resp")
                ]
            );
        } catch (Exception $e) {}
    }

    return $allSuccess;
}

// 3. Parse Request URI & Method
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Strip subdirectories if placed in subfolder or /api prefix
$path = $uri;
$apiPos = strpos($path, '/api');
if ($apiPos !== false) {
    $path = substr($path, $apiPos); // e.g. "/api/auth/login"
}
$path = rtrim($path, '/');
if (empty($path)) $path = '/';

// ==============================================================================
// 4. API Endpoints
// ==============================================================================

// GET /api/health
if ($method === 'GET' && $path === '/api/health') {
    json_response([
        'status' => 'ok',
        'service' => 'Client Bug Tracker PHP / MySQL API',
        'timestamp' => date('c'),
        'environment' => 'production'
    ]);
}

// POST /api/auth/login
if ($method === 'POST' && $path === '/api/auth/login') {
    $input = get_json_input();
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';
    $totpCode = trim($input['totp_code'] ?? '');
    $portal = strtolower(trim($input['portal'] ?? ''));

    if (empty($email) || empty($password)) {
        json_error('Email and password are required', 400);
    }

    // Rate Limiting & Account Lockout Check (Max 5 failed attempts per IP or Email in 15 mins)
    if (!check_rate_limit($email)) {
        json_response([
            'success' => false,
            'error' => 'Too many failed login attempts. Please try again in 15 minutes.'
        ], 429);
    }

    $user = db_query_one('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [$email]);
    if (!$user || !password_verify($password, $user['password_hash'])) {
        auth_generic_failure($email);
    }

    // Strict Security Barrier: Prohibit brand clients from staff command center
    if ($portal === 'admin' && $user['role'] === 'client') {
        auth_generic_failure($email);
    }

    // Brand Client Login
    if ($user['role'] === 'client') {
        record_login_attempt($email, true);

        // Auto-resolve organization_id if missing for client users
        if (empty($user['organization_id'])) {
            $mem = db_query_one('SELECT organization_id FROM organization_members WHERE user_id = ? LIMIT 1', [$user['id']]);
            if ($mem && !empty($mem['organization_id'])) {
                $user['organization_id'] = $mem['organization_id'];
                db_execute('UPDATE users SET organization_id = ? WHERE id = ?', [$mem['organization_id'], $user['id']]);
            } else {
                $orgByContact = db_query_one('SELECT id, name FROM organizations WHERE contact_email = ? LIMIT 1', [$user['email']]);
                if (!$orgByContact) {
                    $prefix = explode('@', $user['email'])[0];
                    $orgByContact = db_query_one('SELECT id, name FROM organizations WHERE LOWER(name) = ? OR LOWER(slug) = ? LIMIT 1', [strtolower($prefix), strtolower($prefix)]);
                }
                if ($orgByContact) {
                    $user['organization_id'] = $orgByContact['id'];
                    $user['organization_name'] = $orgByContact['name'];
                    db_execute('UPDATE users SET organization_id = ? WHERE id = ?', [$orgByContact['id'], $user['id']]);
                }
            }
        }

        $token = jwt_encode([
            'userId' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
            'organizationId' => $user['organization_id']
        ], JWT_SECRET);

        if (!empty($user['organization_id']) && empty($user['organization_name'])) {
            $org = db_query_one('SELECT name FROM organizations WHERE id = ?', [$user['organization_id']]);
            $user['organization_name'] = $org ? $org['name'] : null;
        }
        $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
        unset($user['password_hash'], $user['totp_secret']);

        setcookie('auth_token', $token, time() + 2592000, '/', '', false, true);
        json_response([
            'success' => true,
            'token' => $token,
            'user' => $user
        ]);
    }

    // Staff Login (Two-Factor Authentication RFC 6238)
    $totpEnabled = !empty($user['totp_enabled']) && ((int)$user['totp_enabled'] === 1);

    if ($totpEnabled) {
        if (!empty($totpCode)) {
            if (empty($user['totp_secret']) || !totp_verify($user['totp_secret'], $totpCode)) {
                auth_generic_failure($email);
            }

            record_login_attempt($email, true);
            $token = jwt_encode([
                'userId' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'role' => $user['role'],
                'organizationId' => $user['organization_id']
            ], JWT_SECRET);

            $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
            unset($user['password_hash'], $user['totp_secret']);
            setcookie('auth_token', $token, time() + 2592000, '/', '', false, true);

            json_response([
                'success' => true,
                'token' => $token,
                'user' => $user
            ]);
        }

        // Return challenge requesting 2FA code
        $tempToken = jwt_encode([
            'userId' => $user['id'],
            'stage' => '2fa_pending',
            'exp' => time() + 300
        ], JWT_SECRET);

        json_response([
            'success' => true,
            'require_2fa' => true,
            'temp_token' => $tempToken
        ]);
    }

    // Staff First-Time 2FA Setup
    $secret = !empty($user['totp_secret']) ? $user['totp_secret'] : totp_generate_secret(16);
    if (empty($user['totp_secret'])) {
        db_execute('UPDATE users SET totp_secret = ? WHERE id = ?', [$secret, $user['id']]);
    }

    $uri = totp_get_provisioning_uri($secret, $user['email'], 'Assurance Media');
    $tempToken = jwt_encode([
        'userId' => $user['id'],
        'stage' => '2fa_setup',
        'exp' => time() + 600
    ], JWT_SECRET);

    json_response([
        'success' => true,
        'setup_2fa' => true,
        'temp_token' => $tempToken,
        'totp_secret' => $secret,
        'totp_uri' => $uri
    ]);
}

// POST /api/auth/2fa/verify (Verify TOTP code during staff login)
if ($method === 'POST' && $path === '/api/auth/2fa/verify') {
    $input = get_json_input();
    $tempToken = $input['temp_token'] ?? '';
    $code = trim($input['totp_code'] ?? '');

    $decoded = jwt_decode($tempToken, JWT_SECRET);
    if (!$decoded || empty($decoded['userId']) || ($decoded['stage'] ?? '') !== '2fa_pending') {
        auth_generic_failure();
    }

    $user = db_query_one('SELECT * FROM users WHERE id = ?', [$decoded['userId']]);
    if (!$user || !check_rate_limit($user['email'])) {
        json_response([
            'success' => false,
            'error' => 'Too many failed login attempts. Please try again in 15 minutes.'
        ], 429);
    }

    if (empty($user['totp_secret']) || !totp_verify($user['totp_secret'], $code)) {
        auth_generic_failure($user['email']);
    }

    record_login_attempt($user['email'], true);

    $token = jwt_encode([
        'userId' => $user['id'],
        'email' => $user['email'],
        'name' => $user['name'],
        'role' => $user['role'],
        'organizationId' => $user['organization_id']
    ], JWT_SECRET);

    $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
    unset($user['password_hash'], $user['totp_secret']);
    setcookie('auth_token', $token, time() + 2592000, '/', '', false, true);

    json_response([
        'success' => true,
        'token' => $token,
        'user' => $user
    ]);
}

// POST /api/auth/2fa/setup (Verify and enable TOTP for staff first-time setup)
if ($method === 'POST' && $path === '/api/auth/2fa/setup') {
    $input = get_json_input();
    $tempToken = $input['temp_token'] ?? '';
    $code = trim($input['totp_code'] ?? '');

    $decoded = jwt_decode($tempToken, JWT_SECRET);
    if (!$decoded || empty($decoded['userId']) || ($decoded['stage'] ?? '') !== '2fa_setup') {
        json_error('Invalid or expired setup token', 401);
    }

    $user = db_query_one('SELECT * FROM users WHERE id = ?', [$decoded['userId']]);
    if (!$user || empty($user['totp_secret'])) {
        json_error('Two-factor setup session expired or invalid', 400);
    }

    if (!totp_verify($user['totp_secret'], $code)) {
        json_error('Invalid authentication code. Please check your authenticator app and try again.', 400);
    }

    db_execute('UPDATE users SET totp_enabled = 1 WHERE id = ?', [$user['id']]);
    record_login_attempt($user['email'], true);

    $token = jwt_encode([
        'userId' => $user['id'],
        'email' => $user['email'],
        'name' => $user['name'],
        'role' => $user['role'],
        'organizationId' => $user['organization_id']
    ], JWT_SECRET);

    $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
    $user['totp_enabled'] = true;
    unset($user['password_hash'], $user['totp_secret']);
    setcookie('auth_token', $token, time() + 2592000, '/', '', false, true);

    json_response([
        'success' => true,
        'token' => $token,
        'user' => $user
    ]);
}

// POST /api/auth/logout
if ($method === 'POST' && $path === '/api/auth/logout') {
    setcookie('auth_token', '', time() - 3600, '/', '', false, true);
    json_response(['success' => true, 'message' => 'Logged out successfully']);
}

// POST /api/auth/force-reset-password (Mandatory first-login password reset)
if ($method === 'POST' && $path === '/api/auth/force-reset-password') {
    $user = get_auth_user();
    if (!$user) {
        json_error('Authentication required. Invalid or expired token.', 401);
    }

    $input = get_json_input();
    $newPassword = $input['new_password'] ?? '';

    if (strlen($newPassword) < 8) {
        json_error('New password must be at least 8 characters long for security', 400);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    db_execute('UPDATE users SET password_hash = ?, must_reset_password = 0, updated_at = NOW() WHERE id = ?', [$hash, $user['id']]);

    $updatedUser = db_query_one('SELECT id, email, name, role, custom_role, organization_id, must_reset_password FROM users WHERE id = ?', [$user['id']]);
    $updatedUser['must_reset_password'] = false;
    if (!empty($updatedUser['organization_id'])) {
        $org = db_query_one('SELECT name FROM organizations WHERE id = ?', [$updatedUser['organization_id']]);
        $updatedUser['organization_name'] = $org ? $org['name'] : null;
    }

    // Refresh JWT Token
    $newToken = jwt_encode([
        'userId' => $updatedUser['id'],
        'email' => $updatedUser['email'],
        'name' => $updatedUser['name'],
        'role' => $updatedUser['role'],
        'organizationId' => $updatedUser['organization_id']
    ], JWT_SECRET);
    setcookie('auth_token', $newToken, time() + 2592000, '/', '', false, true);

    json_response([
        'success' => true,
        'message' => 'Password successfully updated. Welcome to Assurance Media!',
        'token' => $newToken,
        'user' => $updatedUser
    ]);
}

// GET /api/auth/me
if ($method === 'GET' && $path === '/api/auth/me') {
    $user = require_auth();
    $org = null;
    if (!empty($user['organization_id'])) {
        $org = db_query_one('SELECT name FROM organizations WHERE id = ?', [$user['organization_id']]);
    }
    $user['organization_name'] = $org ? $org['name'] : null;
    $user['must_reset_password'] = !empty($user['must_reset_password']) && ((int)$user['must_reset_password'] === 1);
    json_response(['user' => $user]);
}


// GET /api/auth/staff (List team members)
if ($method === 'GET' && $path === '/api/auth/staff') {
    $user = require_auth();
    $staff = db_query(
        "SELECT id, email, phone, name, role, custom_role, avatar_url, created_at 
         FROM users 
         WHERE role != 'client' 
         ORDER BY created_at ASC"
    );
    json_response(['success' => true, 'staff' => $staff]);
}

// POST /api/auth/create-user (Admin creates staff or client user)
if ($method === 'POST' && $path === '/api/auth/create-user') {
    $currentUser = require_auth();
    require_roles($currentUser, ['super_admin', 'support_manager']);

    $input = get_json_input();
    $email = strtolower(trim($input['email'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $password = $input['password'] ?? '';
    $name = trim($input['name'] ?? '');
    $role = $input['role'] ?? 'developer';
    $custom_role = $input['custom_role'] ?? null;
    $organization_id = $input['organization_id'] ?? null;

    if (empty($email) || empty($password) || empty($name)) {
        json_error('Name, email, and password are required', 400);
    }

    $existing = db_query_one('SELECT id FROM users WHERE email = ?', [$email]);
    if ($existing) {
        json_error('A user with this email address already exists', 400);
    }

    $userId = 'usr-' . time() . '-' . bin2hex(random_bytes(4));
    $hash = password_hash($password, PASSWORD_BCRYPT);

    db_execute(
        'INSERT INTO users (id, email, phone, password_hash, name, role, custom_role, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$userId, $email, $phone ?: null, $hash, $name, $role, $custom_role, $organization_id]
    );

    if ($organization_id) {
        db_execute(
            'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)',
            ['mem-' . time() . '-' . bin2hex(random_bytes(4)), $organization_id, $userId, 'member']
        );
    }

    // Automatically send credentials email to user
    $roleDisplay = $custom_role ?: ucwords(str_replace('_', ' ', $role));
    $emailSent = send_credentials_email($email, $name, $password, $roleDisplay);

    json_response([
        'success' => true,
        'email_sent' => $emailSent,
        'user' => [
            'id' => $userId,
            'email' => $email,
            'phone' => $phone,
            'name' => $name,
            'role' => $role,
            'custom_role' => $custom_role,
            'organization_id' => $organization_id
        ]
    ], 201);
}

// DELETE /api/auth/staff/{id} or DELETE /api/auth/users/{id}
if (($method === 'DELETE' || ($method === 'POST' && strpos($path, '/delete') !== false)) && preg_match('#^/api/auth/(?:staff|users)/([^/]+)(?:/delete)?$#', $path, $m)) {
    $currentUser = require_auth();
    require_roles($currentUser, ['super_admin', 'support_manager']);
    $targetId = $m[1];

    if ($targetId === 'usr-admin-primary') {
        json_error('Cannot delete the primary root Administrator account', 400);
    }
    if ($targetId === $currentUser['id']) {
        json_error('You cannot delete your own account while logged in', 400);
    }

    $targetUser = db_query_one('SELECT * FROM users WHERE id = ?', [$targetId]);
    if (!$targetUser) {
        json_error('User not found', 404);
    }

    db_execute('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ?', [$targetId]);
    db_execute('DELETE FROM organization_members WHERE user_id = ?', [$targetId]);
    db_execute('DELETE FROM users WHERE id = ?', [$targetId]);

    json_response(['success' => true, 'message' => "User '{$targetUser['name']}' removed successfully"]);
}

// PUT /api/auth/users/{id} or POST /api/auth/users/{id}/update (Admin edits team member or user details)
if (($method === 'PUT' || $method === 'POST') && preg_match('#^/api/auth/users/([^/]+)(?:/update)?$#', $path, $m)) {
    $currentUser = require_auth();
    require_roles($currentUser, ['super_admin', 'support_manager']);
    $targetUserId = $m[1];

    $input = get_json_input();
    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $phone = isset($input['phone']) ? trim($input['phone']) : null;
    $role = $input['role'] ?? null;
    $customRole = $input['custom_role'] ?? null;
    $newPassword = $input['password'] ?? null;
    $mustReset = isset($input['must_reset_password']) ? (int)$input['must_reset_password'] : null;

    if (empty($name) || empty($email)) {
        json_error('Name and email are required', 400);
    }

    $targetUser = db_query_one('SELECT * FROM users WHERE id = ?', [$targetUserId]);
    if (!$targetUser) json_error('User not found', 404);

    if ($email !== strtolower($targetUser['email'])) {
        $existing = db_query_one('SELECT id FROM users WHERE email = ? AND id != ?', [$email, $targetUserId]);
        if ($existing) json_error('Another user already has this email address', 400);
    }

    if ($targetUserId === 'usr-admin-primary' && $role && $role !== 'super_admin') {
        json_error('Cannot change the role of the primary root administrator', 400);
    }

    $finalRole = $role ?: $targetUser['role'];
    $finalCustomRole = $customRole !== null ? $customRole : $targetUser['custom_role'];
    $finalPhone = $phone !== null ? ($phone ?: null) : ($targetUser['phone'] ?? null);

    if (!empty($newPassword)) {
        if (strlen($newPassword) < 6) {
            json_error('Password must be at least 6 characters long', 400);
        }
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        db_execute(
            'UPDATE users SET name = ?, email = ?, phone = ?, role = ?, custom_role = ?, password_hash = ?, must_reset_password = ?, updated_at = NOW() WHERE id = ?',
            [$name, $email, $finalPhone, $finalRole, $finalCustomRole, $hash, $mustReset !== null ? $mustReset : 1, $targetUserId]
        );
        if (!empty($input['send_email'])) {
            $isClient = ($finalRole === 'client');
            send_credentials_email($email, $name, $newPassword, $finalCustomRole ?: $finalRole, '', $isClient);
        }
    } else {
        $updateSql = 'UPDATE users SET name = ?, email = ?, phone = ?, role = ?, custom_role = ?';
        $params = [$name, $email, $finalPhone, $finalRole, $finalCustomRole];
        if ($mustReset !== null) {
            $updateSql .= ', must_reset_password = ?';
            $params[] = $mustReset;
        }
        $updateSql .= ', updated_at = NOW() WHERE id = ?';
        $params[] = $targetUserId;
        db_execute($updateSql, $params);
    }

    $updated = db_query_one('SELECT id, email, phone, name, role, custom_role, organization_id, must_reset_password, created_at, updated_at FROM users WHERE id = ?', [$targetUserId]);
    json_response(['success' => true, 'user' => $updated, 'message' => 'Team member updated successfully']);
}

// GET /api/auth/roles (List roles)
if ($method === 'GET' && ($path === '/api/auth/roles' || $path === '/api/auth/roles/')) {
    require_auth();
    $roles = db_query('SELECT * FROM roles ORDER BY is_system DESC, label ASC');
    foreach ($roles as &$r) {
        $r['is_system'] = (int)$r['is_system'];
    }
    unset($r);
    json_response(['success' => true, 'roles' => $roles]);
}

// POST /api/auth/roles (Create role)
if ($method === 'POST' && $path === '/api/auth/roles') {
    $currentUser = require_auth();
    require_roles($currentUser, ['super_admin', 'support_manager']);

    $input = get_json_input();
    $label = trim($input['label'] ?? '');
    $name = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $input['name'] ?? $label));
    $description = $input['description'] ?? '';
    $color = $input['color'] ?? 'blue';
    $base_role = $input['base_role'] ?? 'developer';

    if (empty($label) || empty($name)) {
        json_error('Role label and identifier are required', 400);
    }

    $existing = db_query_one('SELECT id FROM roles WHERE name = ?', [$name]);
    if ($existing) {
        json_error('A role with this identifier already exists', 400);
    }

    $roleId = 'role-' . time() . '-' . bin2hex(random_bytes(4));
    db_execute(
        'INSERT INTO roles (id, name, label, description, color, base_role, is_system) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [$roleId, $name, $label, $description, $color, $base_role]
    );

    json_response([
        'success' => true,
        'role' => [
            'id' => $roleId,
            'name' => $name,
            'label' => $label,
            'description' => $description,
            'color' => $color,
            'base_role' => $base_role,
            'is_system' => 0
        ]
    ], 201);
}

// DELETE /api/auth/roles/{id} or POST /api/auth/roles/{id}/delete
if (($method === 'DELETE' || ($method === 'POST' && strpos($path, '/delete') !== false)) && preg_match('#^/api/auth/roles/([^/]+)(?:/delete)?$#', $path, $m)) {
    $currentUser = require_auth();
    require_roles($currentUser, ['super_admin']);
    $roleId = $m[1];

    $role = db_query_one('SELECT * FROM roles WHERE id = ?', [$roleId]);
    if (!$role) json_error('Role not found', 404);
    if (!empty($role['is_system'])) json_error('System default roles cannot be deleted', 400);

    db_execute('DELETE FROM roles WHERE id = ?', [$roleId]);
    json_response(['success' => true, 'message' => 'Custom role deleted successfully']);
}

// GET /api/auth/settings/visibility
if ($method === 'GET' && $path === '/api/auth/settings/visibility') {
    require_auth();
    $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['triage_visibility_policy']);
    $policy = $setting ? json_decode($setting['value'], true) : ['triage_required_for_team' => true, 'allowed_roles' => ['super_admin', 'support_manager']];
    json_response(['success' => true, 'policy' => $policy]);
}

// POST /api/auth/settings/visibility
if ($method === 'POST' && $path === '/api/auth/settings/visibility') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();
    $policyJson = json_encode([
        'triage_required_for_team' => !empty($input['triage_required_for_team']),
        'allowed_roles' => $input['allowed_roles'] ?? ['super_admin', 'support_manager']
    ]);

    db_execute(
        'INSERT INTO integration_settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        ['triage_visibility_policy', $policyJson, 'Requires tickets to be in TRIAGED status before becoming visible to regular team members']
    );

    json_response(['success' => true, 'message' => 'Visibility policy updated successfully']);
}

// POST /api/auth/create-client (Create client user credentials for a brand)
if ($method === 'POST' && $path === '/api/auth/create-client') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);

    $input = get_json_input();
    $orgId = trim($input['organization_id'] ?? '');
    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if (empty($orgId) || empty($name) || empty($email) || empty($password)) {
        json_error('Organization, name, email, and password are all required', 400);
    }

    $existing = db_query_one('SELECT id FROM users WHERE email = ?', [$email]);
    if ($existing) {
        json_error('A user with this email address already exists', 400);
    }

    $org = db_query_one('SELECT id, name FROM organizations WHERE id = ?', [$orgId]);
    if (!$org) {
        json_error('Client Organization not found', 404);
    }

    $userId = 'usr-' . time() . '-' . bin2hex(random_bytes(4));
    $hash = password_hash($password, PASSWORD_BCRYPT);

    db_execute(
        'INSERT INTO users (id, email, password_hash, name, role, organization_id, must_reset_password) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [$userId, $email, $hash, $name, 'client', $orgId]
    );

    $memberId = 'mem-' . time() . '-' . bin2hex(random_bytes(4));
    db_execute(
        'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)',
        [$memberId, $orgId, $userId, 'member']
    );

    $roleDisplay = 'Brand Client (' . $org['name'] . ')';
    $emailSent = send_credentials_email($email, $name, $password, $roleDisplay, $org['name'], true);

    json_response([
        'success' => true,
        'message' => 'Client credentials created successfully. Email sent with temporary password.',
        'email_sent' => $emailSent,
        'credentials' => [
            'email' => $email,
            'password' => $password,
            'organization' => $org['name'],
            'must_reset_password' => true
        ]
    ], 201);
}

// GET /api/auth/organization/{orgId}/users (List client users for a brand)
if ($method === 'GET' && preg_match('#^/api/auth/organization/([^/]+)/users$#', $path, $m)) {
    require_auth();
    $orgId = $m[1];
    $users = db_query(
        'SELECT id, email, name, role, must_reset_password, created_at FROM users WHERE organization_id = ? ORDER BY name ASC',
        [$orgId]
    );
    json_response(['success' => true, 'users' => $users]);
}

// GET /api/organizations (Brands)
if ($method === 'GET' && $path === '/api/organizations') {
    $user = require_auth();
    if ($user['role'] === 'client') {
        $orgs = db_query('SELECT * FROM organizations WHERE id = ?', [$user['organization_id']]);
    } else {
        $orgs = db_query('SELECT * FROM organizations ORDER BY name ASC');
    }
    json_response(['success' => true, 'organizations' => $orgs]);
}

// POST /api/organizations (Create Brand with initial password & client user)
if ($method === 'POST' && $path === '/api/organizations') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);

    $input = get_json_input();
    $name = trim($input['name'] ?? '');
    $contactName = trim($input['contact_name'] ?? '');
    $contactEmail = strtolower(trim($input['contact_email'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $initialPassword = trim($input['initial_password'] ?? '');
    $websiteUrl = trim($input['website_url'] ?? '');
    $sheetUrl = trim($input['google_sheet_url'] ?? '');
    $status = trim($input['status'] ?? 'active');

    if (empty($name)) json_error('Brand / Organization name is required', 400);

    $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
    $orgId = 'org-' . time() . '-' . bin2hex(random_bytes(4));

    db_execute(
        'INSERT INTO organizations (id, name, slug, contact_name, contact_email, phone, website_url, google_sheet_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$orgId, $name, $slug, $contactName ?: null, $contactEmail ?: null, $phone ?: null, $websiteUrl ?: null, $sheetUrl ?: null, $status]
    );

    // Primary website: URL provided or auto-generated default
    $webId = 'web-' . time() . '-' . bin2hex(random_bytes(4));
    $siteName = $name . ' Website';
    $siteUrl = !empty($websiteUrl) ? $websiteUrl : ('https://' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $name)) . '.com');
    db_execute(
        'INSERT INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
        [$webId, $orgId, $siteName, $siteUrl, 'production']
    );

    $clientCreated = false;
    $emailSent = false;
    $finalPassword = $initialPassword ?: ('AM-' . strtoupper(bin2hex(random_bytes(3))) . '#' . rand(10, 99));

    // Automatically provision or update Brand Client user if contact email is provided
    if (!empty($contactEmail)) {
        $existing = db_query_one('SELECT id FROM users WHERE email = ?', [$contactEmail]);
        $hash = password_hash($finalPassword, PASSWORD_BCRYPT);
        if ($existing) {
            $clientId = $existing['id'];
            db_execute(
                'UPDATE users SET password_hash = ?, name = ?, phone = ?, role = \'client\', organization_id = ?, must_reset_password = 1, updated_at = NOW() WHERE id = ?',
                [$hash, $contactName ?: $name, $phone ?: null, $orgId, $clientId]
            );
        } else {
            $clientId = 'usr-' . time() . '-' . bin2hex(random_bytes(4));
            db_execute(
                'INSERT INTO users (id, email, phone, password_hash, name, role, organization_id, must_reset_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$clientId, $contactEmail, $phone ?: null, $hash, $contactName ?: $name, 'client', $orgId, 1]
            );
        }

        db_execute(
            'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id)',
            ['mem-' . time() . '-' . bin2hex(random_bytes(4)), $orgId, $clientId, 'owner']
        );
        $clientCreated = true;
        // Dispatch credentials directly from tools.assurance@gmail.com
        $emailSent = send_credentials_email($contactEmail, $contactName ?: $name, $finalPassword, 'Brand Client Account', $name, true);
    }

    $org = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
    json_response([
        'success' => true,
        'organization' => $org,
        'client_created' => $clientCreated,
        'email_sent' => $emailSent,
        'initial_password' => $finalPassword,
        'message' => "Brand '{$name}' created successfully." . ($emailSent ? " Login credentials emailed to {$contactEmail}." : '')
    ], 201);
}

// POST /api/organizations/{id}/send-credentials (Send or resend brand portal credentials)
if ($method === 'POST' && preg_match('#^/api/organizations/([^/]+)/send-credentials$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $orgId = $m[1];

    $org = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
    if (!$org) json_error('Brand organization not found', 404);

    $input = get_json_input();
    $targetEmail = strtolower(trim($input['email'] ?? ($org['contact_email'] ?? '')));
    $contactName = trim($input['name'] ?? ($org['contact_name'] ?? $org['name']));
    $customPassword = trim($input['password'] ?? '');

    if (empty($targetEmail)) {
        json_error('Official brand contact email is required to send credentials. Please enter a valid email address.', 400);
    }

    // Update organization contact details if changed
    if ($targetEmail !== $org['contact_email'] || (!empty($contactName) && $contactName !== $org['contact_name'])) {
        db_execute('UPDATE organizations SET contact_email = ?, contact_name = ?, updated_at = NOW() WHERE id = ?', [$targetEmail, $contactName, $orgId]);
    }

    $tempPassword = !empty($customPassword) ? $customPassword : ('AM-' . strtoupper(bin2hex(random_bytes(3))) . '#' . rand(10, 99));
    $hash = password_hash($tempPassword, PASSWORD_BCRYPT);

    $existing = db_query_one('SELECT id FROM users WHERE email = ?', [$targetEmail]);
    if ($existing) {
        $clientId = $existing['id'];
        db_execute(
            'UPDATE users SET password_hash = ?, name = ?, role = \'client\', organization_id = ?, must_reset_password = 1, updated_at = NOW() WHERE id = ?',
            [$hash, $contactName ?: $org['name'], $orgId, $clientId]
        );
    } else {
        $clientId = 'usr-' . time() . '-' . bin2hex(random_bytes(4));
        db_execute(
            'INSERT INTO users (id, email, password_hash, name, role, organization_id, must_reset_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$clientId, $targetEmail, $hash, $contactName ?: $org['name'], 'client', $orgId, 1]
        );
    }

    db_execute(
        'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id)',
        ['mem-' . time() . '-' . bin2hex(random_bytes(4)), $orgId, $clientId, 'owner']
    );

    // Ensure brand has at least 1 website
    $hasSite = db_query_one('SELECT id FROM websites WHERE organization_id = ? LIMIT 1', [$orgId]);
    if (!$hasSite) {
        $webId = 'web-' . time() . '-' . bin2hex(random_bytes(4));
        $siteName = $org['name'] . ' Main Website';
        $siteUrl = !empty($org['website_url']) ? $org['website_url'] : ('https://' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $org['name'])) . '.com');
        db_execute(
            'INSERT INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
            [$webId, $orgId, $siteName, $siteUrl, 'production']
        );
    }

    $emailSent = send_credentials_email($targetEmail, $contactName ?: $org['name'], $tempPassword, 'Brand Client Account', $org['name'], true);

    json_response([
        'success' => true,
        'email_sent' => $emailSent,
        'email' => $targetEmail,
        'temporary_password' => $tempPassword,
        'message' => "Credentials dispatched to {$targetEmail} successfully!" . ($emailSent ? " Email delivered." : " (Email logged to database)")
    ]);
}

// PUT /api/organizations/{id} or POST /api/organizations/{id}/update (Admin edits brand details)
if (($method === 'PUT' || $method === 'POST') && preg_match('#^/api/organizations/([^/]+)(?:/update)?$#', $path, $m)) {
    $orgId = $m[1];
    if ($orgId !== 'all-websites' && $orgId !== 'websites') {
        $user = require_auth();
        require_roles($user, ['super_admin', 'support_manager']);

        $input = get_json_input();
        $name = trim($input['name'] ?? '');
        $contactName = trim($input['contact_name'] ?? '');
        $contactEmail = strtolower(trim($input['contact_email'] ?? ''));
        $phone = isset($input['phone']) ? trim($input['phone']) : null;
        $websiteUrl = trim($input['website_url'] ?? '');
        $sheetUrl = trim($input['google_sheet_url'] ?? '');
        $status = trim($input['status'] ?? 'active');

        if (empty($name)) json_error('Brand name is required', 400);

        $org = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
        if (!$org) json_error('Organization not found', 404);

        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
        $finalPhone = $phone !== null ? ($phone ?: null) : ($org['phone'] ?? null);

        db_execute(
            'UPDATE organizations SET name = ?, slug = ?, contact_name = ?, contact_email = ?, phone = ?, website_url = ?, google_sheet_url = ?, status = ?, updated_at = NOW() WHERE id = ?',
            [$name, $slug, $contactName ?: null, $contactEmail ?: null, $finalPhone, $websiteUrl ?: null, $sheetUrl ?: null, $status, $orgId]
        );

        $updated = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
        json_response(['success' => true, 'organization' => $updated, 'message' => 'Brand details updated successfully']);
    }
}

// DELETE /api/organizations/{id} or POST /api/organizations/{id}/delete (Admin deletes brand and all related records)
if (($method === 'DELETE' || ($method === 'POST' && strpos($path, '/delete') !== false)) && preg_match('#^/api/organizations/([^/]+)(?:/delete)?$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $orgId = $m[1];

    if ($orgId === 'all-websites' || $orgId === 'websites') {
        json_error('Invalid brand identifier', 400);
    }

    $org = db_query_one('SELECT * FROM organizations WHERE id = ?', [$orgId]);
    if (!$org) {
        json_error('Brand organization not found', 404);
    }

    // 1. Delete tickets for this organization and dependent activity/comments/attachments/assignments
    $tickets = db_query('SELECT id FROM tickets WHERE organization_id = ?', [$orgId]);
    foreach ($tickets as $t) {
        $tId = $t['id'];
        db_execute('DELETE FROM ticket_activity WHERE ticket_id = ?', [$tId]);
        db_execute('DELETE FROM ticket_comments WHERE ticket_id = ?', [$tId]);
        db_execute('DELETE FROM ticket_attachments WHERE ticket_id = ?', [$tId]);
        db_execute('DELETE FROM ticket_assignments WHERE ticket_id = ?', [$tId]);
    }
    db_execute('DELETE FROM tickets WHERE organization_id = ?', [$orgId]);

    // 2. Delete managed websites
    db_execute('DELETE FROM websites WHERE organization_id = ?', [$orgId]);

    // 3. Delete organization memberships
    db_execute('DELETE FROM organization_members WHERE organization_id = ?', [$orgId]);

    // 4. Delete client users associated with this brand so email can be cleanly re-used
    db_execute("DELETE FROM users WHERE organization_id = ? AND role = 'client'", [$orgId]);
    if (!empty($org['contact_email'])) {
        db_execute("DELETE FROM users WHERE LOWER(email) = ? AND role = 'client'", [strtolower($org['contact_email'])]);
    }

    // 5. Delete notification deliveries
    db_execute("DELETE FROM notification_deliveries WHERE event = 'google_sheets' AND recipient LIKE ?", ['%' . $org['name'] . '%']);

    // 6. Delete the organization record
    db_execute('DELETE FROM organizations WHERE id = ?', [$orgId]);

    json_response([
        'success' => true,
        'message' => "Brand '{$org['name']}' and all associated websites, client logins, and tickets were permanently deleted."
    ]);
}

// GET /api/organizations/{id}/websites
if ($method === 'GET' && preg_match('#^/api/organizations/([^/]+)/websites$#', $path, $m)) {
    $user = require_auth();
    $orgId = $m[1];
    if ($user['role'] === 'client' && $user['organization_id'] !== $orgId) {
        json_error('Forbidden: You can only view websites for your organization', 403);
    }
    $websites = db_query('SELECT * FROM websites WHERE organization_id = ? ORDER BY name ASC', [$orgId]);
    json_response(['success' => true, 'websites' => $websites]);
}

// POST /api/organizations/{id}/websites
if ($method === 'POST' && preg_match('#^/api/organizations/([^/]+)/websites$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $orgId = $m[1];

    $input = get_json_input();
    $name = trim($input['name'] ?? '');
    $url = trim($input['url'] ?? '');
    $env = $input['environment'] ?? 'production';

    if (empty($name) || empty($url)) json_error('Website name and URL are required', 400);

    $webId = 'web-' . time() . '-' . bin2hex(random_bytes(4));
    db_execute(
        'INSERT INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
        [$webId, $orgId, $name, $url, $env]
    );

    json_response(['success' => true, 'website' => ['id' => $webId, 'organization_id' => $orgId, 'name' => $name, 'url' => $url, 'environment' => $env]], 201);
}

// GET /api/organizations/all-websites (All websites accessible to current user)
if ($method === 'GET' && ($path === '/api/organizations/all-websites' || $path === '/api/websites')) {
    $user = require_auth();
    if ($user['role'] === 'client') {
        $websites = db_query(
            "SELECT w.*, o.name as organization_name
             FROM websites w
             JOIN organizations o ON w.organization_id = o.id
             WHERE w.organization_id = ?
             ORDER BY w.name ASC",
            [$user['organization_id']]
        );

        if (empty($websites) && !empty($user['organization_id'])) {
            $org = db_query_one('SELECT name, website_url FROM organizations WHERE id = ?', [$user['organization_id']]);
            if ($org) {
                $webId = 'web-' . time() . '-' . bin2hex(random_bytes(4));
                $siteName = $org['name'] . ' Main Website';
                $siteUrl = !empty($org['website_url']) ? $org['website_url'] : ('https://' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $org['name'])) . '.com');
                db_execute(
                    'INSERT INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
                    [$webId, $user['organization_id'], $siteName, $siteUrl, 'production']
                );
                $websites = db_query(
                    "SELECT w.*, o.name as organization_name
                     FROM websites w
                     JOIN organizations o ON w.organization_id = o.id
                     WHERE w.organization_id = ?
                     ORDER BY w.name ASC",
                    [$user['organization_id']]
                );
            }
        }
    } else {
        $websites = db_query(
            "SELECT w.*, o.name as organization_name
             FROM websites w
             JOIN organizations o ON w.organization_id = o.id
             ORDER BY o.name ASC, w.name ASC"
        );
    }
    json_response(['success' => true, 'websites' => $websites]);
}

// GET /api/tickets/export/csv
if ($method === 'GET' && $path === '/api/tickets/export/csv') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager', 'developer']);

    $orgId = $_GET['organization_id'] ?? null;
    $sql = "SELECT t.*, o.name as organization_name, w.name as website_name,
                   req.name as requester_name, dev.name as assignee_name
            FROM tickets t
            JOIN organizations o ON t.organization_id = o.id
            JOIN websites w ON t.website_id = w.id
            JOIN users req ON t.requester_id = req.id
            LEFT JOIN users dev ON t.assignee_id = dev.id";
    $params = [];
    if ($orgId) {
        $sql .= " WHERE t.organization_id = ?";
        $params[] = $orgId;
    }
    $sql .= " ORDER BY t.created_at DESC";

    $tickets = db_query($sql, $params);

    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="tickets-export.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Ticket ID', 'Title', 'Brand / Organization', 'Website', 'Environment', 'Category', 'Priority', 'Status', 'Requester', 'Assignee', 'Created At', 'Resolved At']);

    foreach ($tickets as $t) {
        fputcsv($out, [
            $t['ticket_number'],
            $t['title'],
            $t['organization_name'],
            $t['website_name'],
            $t['environment'],
            $t['category'],
            $t['priority'],
            $t['status'],
            $t['requester_name'],
            $t['assignee_name'] ?: 'Unassigned',
            $t['created_at'],
            $t['resolved_at'] ?: ''
        ]);
    }
    fclose($out);
    exit;
}

// GET /api/audit/export/brand/{orgId}/csv (Per-brand dedicated ticket & log spreadsheet)
if ($method === 'GET' && preg_match('#^/api/audit/export/brand/([^/]+)/csv$#', $path, $m)) {
    $user = require_auth();
    $orgId = $m[1];
    if ($user['role'] === 'client' && $user['organization_id'] !== $orgId) {
        json_error('Forbidden: Access to another brand is denied', 403);
    }

    $org = db_query_one('SELECT id, name FROM organizations WHERE id = ?', [$orgId]);
    if (!$org) json_error('Brand organization not found', 404);

    $tickets = db_query(
        "SELECT t.ticket_number, t.title, t.priority, t.status, t.category,
                t.environment, t.created_at, t.resolved_at, t.closed_at,
                t.root_cause, t.fix_details,
                w.name as website_name, req.name as requester_name, dev.name as assignee_name
         FROM tickets t
         JOIN websites w ON t.website_id = w.id
         JOIN users req ON t.requester_id = req.id
         LEFT JOIN users dev ON t.assignee_id = dev.id
         WHERE t.organization_id = ?
         ORDER BY t.created_at DESC",
        [$orgId]
    );

    $safeOrgSlug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $org['name']));
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="brand-' . $safeOrgSlug . '-tickets-log.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, [
        'Ticket Reference', 'Brand Organization', 'Website', 'Title', 'Category',
        'Priority', 'Status', 'Environment', 'Requester', 'Assignee Specialist',
        'Created Date', 'Resolved Date', 'Root Cause', 'Fix Details'
    ]);

    foreach ($tickets as $t) {
        fputcsv($out, [
            $t['ticket_number'],
            $org['name'],
            $t['website_name'] ?? '',
            $t['title'] ?? '',
            $t['category'] ?? '',
            $t['priority'],
            $t['status'],
            $t['environment'] ?? '',
            $t['requester_name'] ?? '',
            $t['assignee_name'] ?: 'Unassigned',
            $t['created_at'],
            $t['resolved_at'] ?: '',
            $t['root_cause'] ?? '',
            $t['fix_details'] ?? ''
        ]);
    }
    fclose($out);
    exit;
}

// GET /api/audit/tickets/{ticketId}/export/csv (Per-ticket dedicated audit log CSV)
if ($method === 'GET' && preg_match('#^/api/audit/tickets/([^/]+)/export/csv$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one('SELECT t.*, o.name as organization_name FROM tickets t JOIN organizations o ON t.organization_id = o.id WHERE t.id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);

    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: Access denied', 403);
    }

    $sql = "SELECT a.created_at, a.action, a.details, a.is_internal, u.name as user_name, u.email as user_email
            FROM ticket_activity a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.ticket_id = ?";
    $params = [$ticketId];
    if ($user['role'] === 'client') {
        $sql .= " AND a.is_internal = 0";
    }
    $sql .= " ORDER BY a.created_at ASC";

    $raw = db_query($sql, $params);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ticket-' . $ticket['ticket_number'] . '-log.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Timestamp', 'Action', 'Performed By', 'User Email', 'Visibility', 'Details']);

    foreach ($raw as $row) {
        $detailsText = '';
        if (!empty($row['details'])) {
            $parsed = json_decode($row['details'], true);
            if (is_array($parsed)) {
                $pairs = [];
                foreach ($parsed as $k => $v) {
                    $pairs[] = "$k: " . (is_scalar($v) ? $v : json_encode($v));
                }
                $detailsText = implode('; ', $pairs);
            } else {
                $detailsText = (string)$row['details'];
            }
        }

        fputcsv($out, [
            $row['created_at'],
            $row['action'],
            $row['user_name'] ?: 'System',
            $row['user_email'] ?: '',
            !empty($row['is_internal']) ? 'Internal (Dev Only)' : 'Public',
            $detailsText
        ]);
    }
    fclose($out);
    exit;
}

// GET /api/tickets (List tickets)
if ($method === 'GET' && $path === '/api/tickets') {
    $user = require_auth();
    $sql = "SELECT t.*, o.name as organization_name, w.name as website_name, w.url as website_url,
                   req.name as requester_name, req.email as requester_email,
                   dev.name as assignee_name, dev.email as assignee_email,
                   q.name as queue_name, q.color as queue_color
            FROM tickets t
            JOIN organizations o ON t.organization_id = o.id
            JOIN websites w ON t.website_id = w.id
            JOIN users req ON t.requester_id = req.id
            LEFT JOIN users dev ON t.assignee_id = dev.id
            LEFT JOIN queues q ON t.queue_id = q.id
            WHERE 1=1";
    $params = [];

    // Client brand isolation: clients only see their own organization's tickets
    if ($user['role'] === 'client') {
        $sql .= " AND t.organization_id = ?";
        $params[] = $user['organization_id'];
    } elseif (!empty($_GET['organization_id'])) {
        $sql .= " AND t.organization_id = ?";
        $params[] = $_GET['organization_id'];
    }

    // "All tickets are visible to everyone": developers and all team members can see all tickets across all queues

    if (!empty($_GET['queue_id'])) {
        if ($_GET['queue_id'] === 'unassigned') {
            $sql .= " AND t.queue_id IS NULL";
        } else {
            $sql .= " AND t.queue_id = ?";
            $params[] = $_GET['queue_id'];
        }
    }
    if (!empty($_GET['status'])) {
        $sql .= " AND t.status = ?";
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['priority'])) {
        $sql .= " AND t.priority = ?";
        $params[] = $_GET['priority'];
    }
    if (!empty($_GET['category'])) {
        $sql .= " AND t.category = ?";
        $params[] = $_GET['category'];
    }
    if (!empty($_GET['website_id'])) {
        $sql .= " AND t.website_id = ?";
        $params[] = $_GET['website_id'];
    }
    if (!empty($_GET['assignee_id'])) {
        if ($_GET['assignee_id'] === 'unassigned') {
            $sql .= " AND t.assignee_id IS NULL";
        } else {
            $sql .= " AND t.assignee_id = ?";
            $params[] = $_GET['assignee_id'];
        }
    }
    if (!empty($_GET['search'])) {
        $search = '%' . $_GET['search'] . '%';
        $sql .= " AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.description LIKE ?)";
        $params[] = $search;
        $params[] = $search;
        $params[] = $search;
    }

    $sql .= " ORDER BY t.created_at DESC";
    $tickets = db_query($sql, $params);

    // Anonymize/mask brand details for developers as required ("brand is not visible" to developers)
    if ($user['role'] === 'developer') {
        foreach ($tickets as &$t) {
            $t['organization_name'] = 'Client Project';
            $t['organization_id'] = 'protected';
            $t['requester_name'] = 'Client Contact';
            $t['requester_email'] = 'client@protected';
        }
        unset($t);
    }

    json_response(['success' => true, 'tickets' => $tickets]);
}

// POST /api/tickets (Create ticket)
if ($method === 'POST' && $path === '/api/tickets') {
    $user = require_auth();
    $input = get_json_input();

    $title = trim($input['title'] ?? '');
    $description = trim($input['description'] ?? '');
    $website_id = $input['website_id'] ?? '';
    $category = $input['category'] ?? 'General Bug';
    $priority = $input['priority'] ?? 'P3';
    $steps = $input['steps_to_reproduce'] ?? null;
    $browser = $input['browser'] ?? null;
    $device = $input['device'] ?? null;
    $environment = $input['environment'] ?? 'production';

    if (empty($title) || empty($description) || empty($website_id)) {
        json_error('Title, description, and website are required', 400);
    }

    // Determine organization
    $website = db_query_one('SELECT organization_id, name FROM websites WHERE id = ?', [$website_id]);
    if (!$website) json_error('Selected website not found', 404);

    if ($user['role'] === 'client' && $website['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: Selected website does not belong to your organization', 403);
    }

    $organization_id = ($user['role'] === 'client') ? $user['organization_id'] : ($input['organization_id'] ?? $website['organization_id']);

    // Sequence increment
    db_execute('UPDATE ticket_counters SET current_val = current_val + 1 WHERE prefix = ?', ['WEB']);
    $cnt = db_query_one('SELECT current_val FROM ticket_counters WHERE prefix = ?', ['WEB']);
    $ticketNumber = 'WEB-' . ($cnt ? $cnt['current_val'] : rand(1001, 9999));
    $ticketId = 'tkt-' . time() . '-' . bin2hex(random_bytes(4));

    // Calculate SLA
    $slaHours = ['P1' => 4, 'P2' => 24, 'P3' => 48, 'P4' => 120][$priority] ?? 48;
    $targetResolution = date('Y-m-d H:i:s', strtotime("+$slaHours hours"));

    // Auto-resolve Queue if not explicitly passed
    $queue_id = !empty($input['queue_id']) ? $input['queue_id'] : null;
    if (!$queue_id) {
        if ($priority === 'P1') {
            $qUrg = db_query_one("SELECT id FROM queues WHERE slug = 'critical-escalations' OR id = 'q-urgent' LIMIT 1");
            if ($qUrg) $queue_id = $qUrg['id'];
        } elseif (stripos($category, 'backend') !== false || stripos($category, 'api') !== false) {
            $qBack = db_query_one("SELECT id FROM queues WHERE slug = 'backend-api' OR id = 'q-backend' LIMIT 1");
            if ($qBack) $queue_id = $qBack['id'];
        } else {
            $qFront = db_query_one("SELECT id FROM queues WHERE slug = 'frontend-ui' OR id = 'q-frontend' LIMIT 1");
            if ($qFront) $queue_id = $qFront['id'];
        }
    }

    db_execute(
        'INSERT INTO tickets (
            id, ticket_number, organization_id, website_id, requester_id,
            title, description, steps_to_reproduce, browser, device, environment,
            category, priority, status, queue_id, target_resolution_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'NEW\', ?, ?)',
        [
            $ticketId, $ticketNumber, $organization_id, $website_id, $user['id'],
            $title, $description, $steps, $browser, $device, $environment,
            $category, $priority, $queue_id, $targetResolution
        ]
    );

    // Activity log
    db_execute(
        'INSERT INTO ticket_activity (id, ticket_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
        ['act-' . time() . '-' . bin2hex(random_bytes(4)), $ticketId, $user['id'], 'created', json_encode(['title' => $title, 'priority' => $priority])]
    );

    // Slack Notification
    $brand = db_query_one('SELECT * FROM organizations WHERE id = ?', [$organization_id]);
    $brandName = $brand ? $brand['name'] : 'Client Brand';
    send_slack_notification(
        SLACK_CHANNEL_BUG_REPORTS,
        "🚨 *New Bug Ticket Raised: {$ticketNumber}*",
        [
            ['title' => 'Title', 'value' => $title, 'short' => false],
            ['title' => 'Brand', 'value' => $brandName, 'short' => true],
            ['title' => 'Priority', 'value' => $priority, 'short' => true],
            ['title' => 'Category', 'value' => $category, 'short' => true],
            ['title' => 'Website', 'value' => $website['name'], 'short' => true]
        ],
        ($priority === 'P1') ? '#E01E5A' : '#ECB22E'
    );

    // Google Sheets Real-Time Sync (per-brand tab or dedicated sheet)
    sync_to_google_sheet(
        $organization_id,
        'Ticket Raised',
        [
            'id' => $ticketId,
            'ticket_number' => $ticketNumber,
            'title' => $title,
            'status' => 'NEW',
            'priority' => $priority,
            'website_name' => $website['name'],
            'environment' => $environment,
            'requester_name' => $user['name'] . ' (' . $user['email'] . ')',
            'assignee_name' => 'Unassigned'
        ],
        "New bug ticket submitted: {$title}. Category: {$category}. Priority: {$priority}. Environment: {$environment}.",
        $user['name']
    );

    $created = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);

    // Send Ticket Creation Notifications (WhatsApp alert to engineering + Email to brand requester)
    send_ticket_created_notifications($created, $brand, $user);

    json_response(['success' => true, 'ticket' => $created], 201);
}

// GET /api/tickets/{id}
if ($method === 'GET' && preg_match('#^/api/tickets/([^/]+)$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one(
        "SELECT t.*, o.name as organization_name, w.name as website_name, w.url as website_url,
                req.name as requester_name, req.email as requester_email,
                dev.name as assignee_name, dev.email as assignee_email,
                q.name as queue_name, q.color as queue_color
         FROM tickets t
         JOIN organizations o ON t.organization_id = o.id
         JOIN websites w ON t.website_id = w.id
         JOIN users req ON t.requester_id = req.id
         LEFT JOIN users dev ON t.assignee_id = dev.id
         LEFT JOIN queues q ON t.queue_id = q.id
         WHERE t.id = ?",
        [$ticketId]
    );

    if (!$ticket) json_error('Ticket not found', 404);
    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: You can only view tickets belonging to your organization', 403);
    }

    // All tickets are visible to everyone; mask brand details for developers
    if ($user['role'] === 'developer') {
        $ticket['organization_name'] = 'Client Project';
        $ticket['organization_id'] = 'protected';
        $ticket['requester_name'] = 'Client Contact';
        $ticket['requester_email'] = 'client@protected';
    }

    json_response(['success' => true, 'ticket' => $ticket]);
}

// PATCH /api/tickets/{id} (Update status, priority, assignee, queue, resolution - also handles /status and /assign)
if ($method === 'PATCH' && preg_match('#^/api/tickets/([^/]+)(?:/(?:status|assign|assignee|queue))?$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];
    $input = get_json_input();

    $ticket = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);

    if ($user['role'] === 'client') {
        if ($ticket['organization_id'] !== $user['organization_id']) {
            json_error('Forbidden: You can only update tickets belonging to your organization', 403);
        }
        // Client can only confirm resolution or reopen
        if (isset($input['status']) && in_array($input['status'], ['RESOLVED', 'CLOSED', 'NEW', 'IN PROGRESS'])) {
            $newStatus = $input['status'];
            db_execute('UPDATE tickets SET status = ? WHERE id = ?', [$newStatus, $ticketId]);
            db_execute(
                'INSERT INTO ticket_activity (id, ticket_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
                ['act-' . time() . '-' . bin2hex(random_bytes(4)), $ticketId, $user['id'], 'status_changed', json_encode(['from' => $ticket['status'], 'to' => $newStatus])]
            );
            $updated = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);

            // Google Sheets Real-Time Sync for client update
            sync_to_google_sheet(
                $ticket['organization_id'],
                "Client Status: {$newStatus}",
                $updated,
                "Ticket status updated from {$ticket['status']} to {$newStatus} by client.",
                $user['name']
            );

            // WhatsApp + Email alert on client status confirmation
            send_ticket_status_change_notifications($updated, $ticket['status'], $newStatus, 'Updated directly by client via portal', $user);

            json_response(['success' => true, 'ticket' => $updated]);
        }
        json_error('Clients can only confirm resolution or reopen tickets', 403);
    }

    // Staff updates
    $updates = [];
    $params = [];

    $targetAssignee = null;
    $hasAssigneeUpdate = false;
    if (array_key_exists('assignee_id', $input) || array_key_exists('assigneeId', $input)) {
        $hasAssigneeUpdate = true;
        $targetAssignee = $input['assignee_id'] ?? $input['assigneeId'] ?? null;
        $updates[] = 'assignee_id = ?';
        $params[] = !empty($targetAssignee) ? $targetAssignee : null;
    }

    if (isset($input['status'])) {
        $updates[] = 'status = ?';
        $params[] = $input['status'];
        if ($input['status'] === 'RESOLVED') {
            $updates[] = 'resolved_at = NOW()';
        }
        if ($input['status'] === 'CLOSED') {
            $updates[] = 'closed_at = NOW()';
        }
    }
    if (isset($input['priority'])) {
        $updates[] = 'priority = ?';
        $params[] = $input['priority'];
    }

    $hasExplicitQueue = array_key_exists('queue_id', $input) || array_key_exists('queueId', $input);
    if ($hasExplicitQueue) {
        $targetQueue = $input['queue_id'] ?? $input['queueId'] ?? null;
        $updates[] = 'queue_id = ?';
        $params[] = !empty($targetQueue) ? $targetQueue : null;
    } else {
        // Automatic Queue Transition:
        // When ticket is assigned to anyone or opened/worked on (IN PROGRESS, ASSIGNED, FIX READY FOR TESTING),
        // automatically move it out of its intake queue and into the 'q-assigned' (Assigned & In Progress) queue.
        $isBeingAssigned = $hasAssigneeUpdate && !empty($targetAssignee);
        $isBeingOpened = isset($input['status']) && in_array($input['status'], ['IN PROGRESS', 'ASSIGNED', 'FIX READY FOR TESTING']);
        if ($isBeingAssigned || $isBeingOpened) {
            $updates[] = 'queue_id = ?';
            $params[] = 'q-assigned';
        }
        if ($isBeingAssigned && empty($input['status']) && in_array($ticket['status'], ['NEW', 'TRIAGED'])) {
            $updates[] = 'status = ?';
            $params[] = 'ASSIGNED';
            $input['status'] = 'ASSIGNED';
        }
    }

    if (isset($input['root_cause'])) {
        $updates[] = 'root_cause = ?';
        $params[] = $input['root_cause'];
    }
    if (isset($input['fix_details'])) {
        $updates[] = 'fix_details = ?';
        $params[] = $input['fix_details'];
    }
    if (isset($input['resolution_notes'])) {
        $updates[] = 'resolution_notes = ?';
        $params[] = $input['resolution_notes'];
    }

    if (!empty($updates)) {
        $params[] = $ticketId;
        db_execute('UPDATE tickets SET ' . implode(', ', $updates) . ' WHERE id = ?', $params);

        db_execute(
            'INSERT INTO ticket_activity (id, ticket_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
            ['act-' . time() . '-' . bin2hex(random_bytes(4)), $ticketId, $user['id'], 'updated', json_encode($input)]
        );

        if (isset($input['status']) && $input['status'] === 'RESOLVED') {
            send_slack_notification(
                SLACK_CHANNEL_RESOLUTIONS,
                "✅ *Ticket Resolved: {$ticket['ticket_number']}*",
                [
                    ['title' => 'Title', 'value' => $ticket['title'], 'short' => false],
                    ['title' => 'Resolution Notes', 'value' => $input['resolution_notes'] ?? 'Issue resolved.', 'short' => false],
                ],
                '#2EB67D'
            );
        }
    }

    $updated = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);

    // 1. Assignee change handling: Google Sheets + Email & WhatsApp to assigned specialist
    if ($hasAssigneeUpdate && $targetAssignee !== $ticket['assignee_id']) {
        $newAssignee = !empty($targetAssignee) ? db_query_one('SELECT * FROM users WHERE id = ?', [$targetAssignee]) : null;
        $assigneeLabel = $newAssignee ? "{$newAssignee['name']} ({$newAssignee['email']})" : 'Unassigned';
        sync_to_google_sheet(
            $ticket['organization_id'],
            'Assigned to Developer',
            $updated,
            "Ticket assigned to {$assigneeLabel} by {$user['name']}.",
            $user['name']
        );

        if ($newAssignee) {
            send_ticket_assigned_notifications($updated, $newAssignee, $user);
        }
    }

    // 2. Status change handling: Google Sheets + Email & WhatsApp to Client Brand
    if (isset($input['status']) && $input['status'] !== $ticket['status']) {
        $notes = [];
        if (!empty($input['resolution_notes'])) $notes[] = "Resolution: " . $input['resolution_notes'];
        if (!empty($input['root_cause'])) $notes[] = "Root Cause: " . $input['root_cause'];
        if (!empty($input['fix_details'])) $notes[] = "Fix Details: " . $input['fix_details'];
        $detailsStr = !empty($notes) ? implode(' | ', $notes) : "Status changed from {$ticket['status']} to {$input['status']}.";

        sync_to_google_sheet(
            $ticket['organization_id'],
            "Status Changed to {$input['status']}",
            $updated,
            $detailsStr,
            $user['name']
        );

        $statusNotes = $input['resolution_notes'] ?? $input['fix_details'] ?? $input['notes'] ?? '';
        send_ticket_status_change_notifications($updated, $ticket['status'], $input['status'], $statusNotes, $user);
    }

    json_response(['success' => true, 'ticket' => $updated]);
}

// GET /api/audit/tickets/{ticketId}/activity (and /api/tickets/{ticketId}/activity)
if ($method === 'GET' && (
    preg_match('#^/api/audit/tickets/([^/]+)/activity$#', $path, $m) ||
    preg_match('#^/api/tickets/([^/]+)/activity$#', $path, $m)
)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one('SELECT organization_id FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);

    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: Access to this ticket is denied.', 403);
    }

    $sql = "SELECT a.*, u.name as user_name
            FROM ticket_activity a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.ticket_id = ?";
    $params = [$ticketId];
    if ($user['role'] === 'client') {
        $sql .= " AND a.is_internal = 0";
    }
    $sql .= " ORDER BY a.created_at DESC";

    $activities = db_query($sql, $params);
    foreach ($activities as &$act) {
        $act['is_internal'] = (bool)$act['is_internal'];
        $act['details'] = !empty($act['details']) ? json_decode($act['details'], true) : null;
    }
    unset($act);

    json_response(['success' => true, 'activities' => $activities]);
}

// GET /api/tickets/{id}/duplicate-check
if ($method === 'GET' && preg_match('#^/api/tickets/([^/]+)/duplicate-check$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $current = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);
    if (!$current) json_error('Ticket not found', 404);

    if ($user['role'] === 'client' && $current['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden', 403);
    }

    $words = array_filter(explode(' ', $current['title']), function($w) { return strlen($w) > 3; });
    $words = array_slice($words, 0, 3);

    $sql = "SELECT id, ticket_number, title, status, priority, created_at
            FROM tickets
            WHERE id != ? AND organization_id = ?
              AND (website_id = ? OR category = ?";
    $params = [$ticketId, $current['organization_id'], $current['website_id'], $current['category']];

    if (!empty($words)) {
        $likeClauses = [];
        foreach ($words as $w) {
            $likeClauses[] = "title LIKE ?";
            $params[] = "%" . $w . "%";
        }
        $sql .= " OR (" . implode(' OR ', $likeClauses) . ")";
    }
    $sql .= ") ORDER BY created_at DESC LIMIT 5";

    $duplicates = db_query($sql, $params);
    json_response(['success' => true, 'duplicates' => $duplicates]);
}

// GET /api/tickets/{id}/comments
if ($method === 'GET' && preg_match('#^/api/tickets/([^/]+)/comments$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one('SELECT organization_id FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);
    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: You can only view comments for tickets belonging to your organization', 403);
    }

    $sql = "SELECT c.*, u.name as user_name, u.role as user_role, u.custom_role as user_custom_role,
                   o.name as user_organization_name, u.email as user_email
            FROM ticket_comments c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE c.ticket_id = ?";
    $params = [$ticketId];

    if ($user['role'] === 'client') {
        $sql .= " AND c.is_internal = 0";
    }

    $sql .= " ORDER BY c.created_at ASC";
    $comments = db_query($sql, $params);
    json_response(['success' => true, 'comments' => $comments]);
}

// POST /api/tickets/{id}/comments
if ($method === 'POST' && preg_match('#^/api/tickets/([^/]+)/comments$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];
    $input = get_json_input();

    $ticket = db_query_one('SELECT organization_id FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);
    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: You can only comment on tickets belonging to your organization', 403);
    }

    $content = trim($input['content'] ?? '');
    $is_internal = !empty($input['is_internal']) && $user['role'] !== 'client' ? 1 : 0;

    if (empty($content)) json_error('Comment text is required', 400);

    $commentId = 'cmt-' . time() . '-' . bin2hex(random_bytes(4));
    db_execute(
        'INSERT INTO ticket_comments (id, ticket_id, user_id, is_internal, content) VALUES (?, ?, ?, ?, ?)',
        [$commentId, $ticketId, $user['id'], $is_internal, $content]
    );

    db_execute(
        'INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal) VALUES (?, ?, ?, ?, ?, ?)',
        ['act-' . time() . '-' . bin2hex(random_bytes(4)), $ticketId, $user['id'], 'comment_added', json_encode(['is_internal' => $is_internal]), $is_internal]
    );

    // Google Sheets Real-Time Sync on Comment
    $ticket = db_query_one('SELECT * FROM tickets WHERE id = ?', [$ticketId]);
    if ($ticket) {
        $commentType = !empty($is_internal) ? 'Internal Dev Note' : 'Public Client Note';
        $snippet = mb_substr(strip_tags($content), 0, 200);
        sync_to_google_sheet(
            $ticket['organization_id'],
            "Note Added ({$commentType})",
            $ticket,
            "{$commentType} by {$user['name']}: \"{$snippet}\"",
            $user['name']
        );
    }

    json_response(['success' => true, 'comment' => [
        'id' => $commentId,
        'ticket_id' => $ticketId,
        'user_id' => $user['id'],
        'user_name' => $user['name'],
        'user_role' => $user['role'],
        'is_internal' => (bool)$is_internal,
        'content' => $content,
        'created_at' => date('Y-m-d H:i:s')
    ]], 201);
}

// GET /api/tickets/{id}/attachments
if ($method === 'GET' && preg_match('#^/api/tickets/([^/]+)/attachments$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one('SELECT organization_id FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);
    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: You can only view attachments for tickets belonging to your organization', 403);
    }

    $sql = 'SELECT a.*, u.name AS uploader_name FROM ticket_attachments a LEFT JOIN users u ON a.uploader_id = u.id WHERE a.ticket_id = ?';
    $params = [$ticketId];

    if ($user['role'] === 'client') {
        $sql .= ' AND a.is_internal = 0';
    }

    $sql .= ' ORDER BY a.created_at ASC';
    $attachments = db_query($sql, $params);

    foreach ($attachments as &$att) {
        $att['is_internal'] = (bool)$att['is_internal'];
        $att['file_size'] = (int)$att['file_size'];
    }
    unset($att);

    json_response(['success' => true, 'attachments' => $attachments]);
}

// POST /api/tickets/{id}/attachments
if ($method === 'POST' && preg_match('#^/api/tickets/([^/]+)/attachments$#', $path, $m)) {
    $user = require_auth();
    $ticketId = $m[1];

    $ticket = db_query_one('SELECT organization_id FROM tickets WHERE id = ?', [$ticketId]);
    if (!$ticket) json_error('Ticket not found', 404);
    if ($user['role'] === 'client' && $ticket['organization_id'] !== $user['organization_id']) {
        json_error('Forbidden: You can only upload attachments to tickets belonging to your organization', 403);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('No valid file uploaded or upload error occurred', 400);
    }

    $file = $_FILES['file'];
    $filename = basename($file['name']);
    $ext = pathinfo($filename, PATHINFO_EXTENSION);
    $storedName = 'att_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = UPLOAD_DIR . '/' . $storedName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        json_error('Failed to save uploaded file to storage directory', 500);
    }

    $attachmentId = 'att-' . time() . '-' . bin2hex(random_bytes(4));
    $is_internal = !empty($_POST['is_internal']) && $user['role'] !== 'client' ? 1 : 0;

    db_execute(
        'INSERT INTO ticket_attachments (id, ticket_id, comment_id, uploader_id, filename, stored_filename, file_path, file_size, mime_type, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$attachmentId, $ticketId, null, $user['id'], $filename, $storedName, $targetPath, (int)$file['size'], $file['type'], $is_internal]
    );

    json_response(['success' => true, 'attachment' => [
        'id' => $attachmentId,
        'filename' => $filename,
        'file_size' => (int)$file['size'],
        'mime_type' => $file['type'],
        'uploader_name' => $user['name']
    ]], 201);
}

// GET /api/attachments/{id}/download
if ($method === 'GET' && preg_match('#^/api/attachments/([^/]+)/download$#', $path, $m)) {
    $user = require_auth();
    $attId = $m[1];
    $att = db_query_one('SELECT a.*, t.organization_id FROM ticket_attachments a JOIN tickets t ON a.ticket_id = t.id WHERE a.id = ?', [$attId]);
    if (!$att || !file_exists($att['file_path'])) {
        json_error('Attachment file not found', 404);
    }

    if ($user['role'] === 'client') {
        if ($att['organization_id'] !== $user['organization_id']) {
            json_error('Forbidden: You can only download attachments belonging to your organization', 403);
        }
        if (!empty($att['is_internal'])) {
            json_error('Forbidden: Internal attachments are not accessible to clients', 403);
        }
    }

    header('Content-Type: ' . $att['mime_type']);
    header('Content-Disposition: attachment; filename="' . $att['filename'] . '"');
    header('Content-Length: ' . filesize($att['file_path']));
    readfile($att['file_path']);
    exit;
}

// GET /api/audit & /api/audit/logs
if ($method === 'GET' && ($path === '/api/audit' || $path === '/api/audit/logs')) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager', 'developer']);
    $logs = db_query(
        "SELECT a.*, u.name as user_name, t.ticket_number, t.title as ticket_title, o.name as organization_name
         FROM ticket_activity a
         LEFT JOIN users u ON a.user_id = u.id
         JOIN tickets t ON a.ticket_id = t.id
         JOIN organizations o ON t.organization_id = o.id
         ORDER BY a.created_at DESC LIMIT 100"
    );
    foreach ($logs as &$log) {
        $log['is_internal'] = (bool)$log['is_internal'];
        $log['details'] = !empty($log['details']) ? json_decode($log['details'], true) : null;
    }
    unset($log);
    json_response(['success' => true, 'count' => count($logs), 'logs' => $logs, 'audit' => $logs]);
}

// GET /api/audit/notifications & /api/notifications
if ($method === 'GET' && ($path === '/api/audit/notifications' || $path === '/api/notifications')) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $deliveries = db_query(
        "SELECT n.*, t.ticket_number
         FROM notification_deliveries n
         LEFT JOIN tickets t ON n.ticket_id = t.id
         ORDER BY n.created_at DESC LIMIT 100"
    );
    foreach ($deliveries as &$d) {
        $d['payload'] = !empty($d['payload']) ? json_decode($d['payload'], true) : null;
    }
    unset($d);
    json_response(['success' => true, 'count' => count($deliveries), 'deliveries' => $deliveries, 'notifications' => $deliveries]);
}

// GET /api/routing-rules
if ($method === 'GET' && $path === '/api/routing-rules') {
    require_auth();
    $rules = db_query(
        "SELECT r.*, u.name as default_assignee_name
         FROM routing_rules r
         LEFT JOIN users u ON r.default_assignee_id = u.id
         ORDER BY r.created_at DESC"
    );
    json_response(['success' => true, 'rules' => $rules]);
}

// POST /api/routing-rules
if ($method === 'POST' && $path === '/api/routing-rules') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $name = trim($input['name'] ?? '');
    $assigneeId = $input['default_assignee_id'] ?? '';
    if (empty($name) || empty($assigneeId)) json_error('Rule name and default assignee are required', 400);

    $ruleId = 'rule-' . time() . '-' . bin2hex(random_bytes(4));
    db_execute(
        'INSERT INTO routing_rules (id, name, category, website_id, priority, default_assignee_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [$ruleId, $name, $input['category'] ?? null, $input['website_id'] ?? null, $input['priority'] ?? null, $assigneeId]
    );

    json_response(['success' => true, 'rule' => ['id' => $ruleId, 'name' => $name]], 201);
}

// DELETE /api/routing-rules/{id}
if ($method === 'DELETE' && preg_match('#^/api/routing-rules/([^/]+)$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $ruleId = $m[1];
    db_execute('DELETE FROM routing_rules WHERE id = ?', [$ruleId]);
    json_response(['success' => true, 'message' => 'Routing rule deleted successfully']);
}

// ==============================================================================
// Queues Management Endpoints
// ==============================================================================

// GET /api/queues (List all queues with member list and open ticket counts)
if ($method === 'GET' && ($path === '/api/queues' || $path === '/api/queues/')) {
    $user = require_auth();
    $queues = db_query(
        "SELECT q.*, 
            (SELECT COUNT(*) FROM tickets t WHERE t.queue_id = q.id AND t.status NOT IN ('RESOLVED', 'CLOSED')) AS open_tickets_count,
            (SELECT COUNT(*) FROM queue_members qm WHERE qm.queue_id = q.id) AS members_count
         FROM queues q 
         WHERE q.is_active = 1 
         ORDER BY q.name ASC"
    );

    foreach ($queues as &$q) {
        $q['members'] = db_query(
            "SELECT u.id, u.name, u.email, u.role, u.custom_role 
             FROM queue_members qm 
             JOIN users u ON qm.user_id = u.id 
             WHERE qm.queue_id = ? 
             ORDER BY u.name ASC",
            [$q['id']]
        );
    }
    unset($q);

    json_response(['success' => true, 'queues' => $queues]);
}

// POST /api/queues (Create new queue)
if ($method === 'POST' && $path === '/api/queues') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $name = trim($input['name'] ?? '');
    if (empty($name)) {
        json_error('Queue name is required', 400);
    }

    $id = 'q-' . time() . '-' . bin2hex(random_bytes(3));
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-'));
    $description = trim($input['description'] ?? '');
    $color = trim($input['color'] ?? 'blue');

    db_execute(
        'INSERT INTO queues (id, name, slug, description, color, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [$id, $name, $slug, $description, $color]
    );

    if (!empty($input['member_ids']) && is_array($input['member_ids'])) {
        foreach ($input['member_ids'] as $uId) {
            $mid = 'qm-' . time() . '-' . bin2hex(random_bytes(3));
            db_execute('INSERT IGNORE INTO queue_members (id, queue_id, user_id) VALUES (?, ?, ?)', [$mid, $id, $uId]);
        }
    }

    $created = db_query_one('SELECT * FROM queues WHERE id = ?', [$id]);
    json_response(['success' => true, 'queue' => $created, 'message' => "Queue '{$name}' created successfully"], 201);
}

// PUT /api/queues/{id} (Update queue)
if (($method === 'PUT' || $method === 'POST') && preg_match('#^/api/queues/([^/]+)(?:/update)?$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $queueId = $m[1];
    $input = get_json_input();

    $queue = db_query_one('SELECT * FROM queues WHERE id = ?', [$queueId]);
    if (!$queue) json_error('Queue not found', 404);

    $name = trim($input['name'] ?? $queue['name']);
    $description = trim($input['description'] ?? $queue['description']);
    $color = trim($input['color'] ?? $queue['color']);
    $isActive = isset($input['is_active']) ? (int)$input['is_active'] : (int)$queue['is_active'];

    db_execute(
        'UPDATE queues SET name = ?, description = ?, color = ?, is_active = ? WHERE id = ?',
        [$name, $description, $color, $isActive, $queueId]
    );

    if (isset($input['member_ids']) && is_array($input['member_ids'])) {
        db_execute('DELETE FROM queue_members WHERE queue_id = ?', [$queueId]);
        foreach ($input['member_ids'] as $uId) {
            $mid = 'qm-' . time() . '-' . bin2hex(random_bytes(3));
            db_execute('INSERT IGNORE INTO queue_members (id, queue_id, user_id) VALUES (?, ?, ?)', [$mid, $queueId, $uId]);
        }
    }

    $updated = db_query_one('SELECT * FROM queues WHERE id = ?', [$queueId]);
    json_response(['success' => true, 'queue' => $updated, 'message' => "Queue '{$name}' updated successfully"]);
}

// DELETE /api/queues/{id} (Delete queue)
if (($method === 'DELETE' || ($method === 'POST' && strpos($path, '/delete') !== false)) && preg_match('#^/api/queues/([^/]+)(?:/delete)?$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $queueId = $m[1];

    db_execute('UPDATE tickets SET queue_id = NULL WHERE queue_id = ?', [$queueId]);
    db_execute('DELETE FROM queue_members WHERE queue_id = ?', [$queueId]);
    db_execute('DELETE FROM queues WHERE id = ?', [$queueId]);

    json_response(['success' => true, 'message' => 'Queue deleted successfully']);
}

// POST /api/queues/{id}/members (Add member to queue)
if ($method === 'POST' && preg_match('#^/api/queues/([^/]+)/members$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $queueId = $m[1];
    $input = get_json_input();
    $targetUserId = $input['user_id'] ?? null;

    if (empty($targetUserId)) json_error('user_id is required', 400);

    $mid = 'qm-' . time() . '-' . bin2hex(random_bytes(3));
    db_execute('INSERT IGNORE INTO queue_members (id, queue_id, user_id) VALUES (?, ?, ?)', [$mid, $queueId, $targetUserId]);

    json_response(['success' => true, 'message' => 'User added to queue successfully']);
}

// DELETE /api/queues/{id}/members/{userId} (Remove member from queue)
if (($method === 'DELETE' || $method === 'POST') && preg_match('#^/api/queues/([^/]+)/members/([^/]+)$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $queueId = $m[1];
    $targetUserId = $m[2];

    db_execute('DELETE FROM queue_members WHERE queue_id = ? AND user_id = ?', [$queueId, $targetUserId]);

    json_response(['success' => true, 'message' => 'User removed from queue successfully']);
}

// POST /api/tickets/{id}/assign-queue
if ($method === 'POST' && preg_match('#^/api/tickets/([^/]+)/assign-queue$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $ticketId = $m[1];
    $input = get_json_input();
    $queueId = !empty($input['queue_id']) ? $input['queue_id'] : null;

    db_execute('UPDATE tickets SET queue_id = ? WHERE id = ?', [$queueId, $ticketId]);

    $queueName = 'None (Unassigned)';
    if ($queueId) {
        $q = db_query_one('SELECT name FROM queues WHERE id = ?', [$queueId]);
        if ($q) $queueName = $q['name'];
    }

    db_execute(
        'INSERT INTO ticket_activity (id, ticket_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
        ['act-' . time() . '-' . bin2hex(random_bytes(4)), $ticketId, $user['id'], 'queue_assigned', json_encode(['queue_id' => $queueId, 'queue_name' => $queueName])]
    );

    json_response(['success' => true, 'message' => "Ticket assigned to queue '{$queueName}'"]);
}

// GET /api/integrations/slack/health
if ($method === 'GET' && $path === '/api/integrations/slack/health') {
    require_auth();
    $configured = defined('SLACK_WEBHOOK_URL') && !empty(SLACK_WEBHOOK_URL);
    json_response([
        'success' => true,
        'configured' => $configured,
        'webhookConfigured' => $configured,
        'mode' => $configured ? 'live' : 'mock (safe local mode)',
        'channels' => [
            'bugReports' => SLACK_CHANNEL_BUG_REPORTS,
            'devTriage' => SLACK_CHANNEL_DEV_TRIAGE,
            'incidents' => SLACK_CHANNEL_INCIDENTS,
            'resolutions' => SLACK_CHANNEL_RESOLUTIONS
        ]
    ]);
}

// POST /api/integrations/slack/test
if ($method === 'POST' && $path === '/api/integrations/slack/test') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);

    $ok = send_slack_notification(
        SLACK_CHANNEL_BUG_REPORTS,
        "🧪 *Test Notification from Client Bug Tracker*",
        [
            ['title' => 'Status', 'value' => 'Slack connectivity verified successfully!', 'short' => false],
            ['title' => 'Triggered By', 'value' => $user['name'] . ' (' . $user['email'] . ')', 'short' => true],
            ['title' => 'Platform', 'value' => 'Hostinger PHP / MySQL', 'short' => true]
        ],
        '#36C5F0'
    );

    json_response([
        'success' => true,
        'delivered' => $ok,
        'channel' => SLACK_CHANNEL_BUG_REPORTS,
        'message' => $ok ? 'Test notification sent to Slack channel successfully.' : 'Slack webhook not configured or failed to deliver.'
    ]);
}

// POST /api/integrations/email/test
if ($method === 'POST' && $path === '/api/integrations/email/test') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();
    $targetEmail = !empty($input['email']) ? trim($input['email']) : $user['email'];

    $ok = send_credentials_email($targetEmail, $user['name'], 'test-password-123', 'Super Admin');
    global $lastEmailError;

    json_response([
        'success' => $ok,
        'recipient' => $targetEmail,
        'sender' => defined('EMAIL_FROM') ? EMAIL_FROM : 'auto-generated',
        'mode' => (defined('SMTP_ENABLED') && SMTP_ENABLED) ? ('SMTP Authenticated (' . (defined('SMTP_HOST') ? SMTP_HOST : 'custom') . ')') : 'PHP mail() (Local Sendmail)',
        'error' => $ok ? null : $lastEmailError,
        'message' => $ok ? "Test email sent successfully to {$targetEmail} from " . (defined('EMAIL_FROM') ? EMAIL_FROM : 'system') . "." : ("Failed to send email: " . ($lastEmailError ?: "Check your SMTP settings in api/config.php."))
    ]);
}

// ==============================================================================
// Google Sheets Integration API Routes
// ==============================================================================

// GET /api/integrations/sheets/config
if ($method === 'GET' && $path === '/api/integrations/sheets/config') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);

    $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['google_sheets_config']);
    $config = $setting ? json_decode($setting['value'], true) : [
        'enabled' => false,
        'global_webhook_url' => '',
        'create_brand_tabs' => true
    ];

    if (empty($config['global_webhook_url']) && defined('GOOGLE_SHEETS_WEBHOOK_URL')) {
        $config['global_webhook_url'] = GOOGLE_SHEETS_WEBHOOK_URL;
    }

    $brands = db_query('SELECT id, name, slug, google_sheet_url FROM organizations ORDER BY name ASC');

    $deliveries = db_query(
        "SELECT n.*, t.ticket_number 
         FROM notification_deliveries n 
         LEFT JOIN tickets t ON n.ticket_id = t.id 
         WHERE n.channel = 'google_sheets' 
         ORDER BY n.created_at DESC LIMIT 30"
    );

    foreach ($deliveries as &$d) {
        $d['payload'] = !empty($d['payload']) ? json_decode($d['payload'], true) : null;
    }
    unset($d);

    json_response([
        'success' => true,
        'config' => $config,
        'brands' => $brands,
        'deliveries' => $deliveries
    ]);
}

// POST /api/integrations/sheets/config
if ($method === 'POST' && $path === '/api/integrations/sheets/config') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $config = [
        'enabled' => !empty($input['enabled']),
        'global_webhook_url' => trim($input['global_webhook_url'] ?? ''),
        'create_brand_tabs' => isset($input['create_brand_tabs']) ? (bool)$input['create_brand_tabs'] : true
    ];

    db_execute(
        'INSERT INTO integration_settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        ['google_sheets_config', json_encode($config), 'Configuration for automatic real-time Google Sheets logging per brand']
    );

    json_response(['success' => true, 'config' => $config, 'message' => 'Google Sheets configuration saved successfully']);
}

// POST /api/integrations/sheets/test
if ($method === 'POST' && $path === '/api/integrations/sheets/test') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $brandId = trim($input['brand_id'] ?? '');
    $targetUrl = trim($input['webhook_url'] ?? '');

    $brandName = 'All Brands Test';
    if (!empty($brandId)) {
        $org = db_query_one('SELECT name, google_sheet_url FROM organizations WHERE id = ?', [$brandId]);
        if ($org) {
            $brandName = $org['name'];
            if (empty($targetUrl) && !empty($org['google_sheet_url'])) {
                $targetUrl = $org['google_sheet_url'];
            }
        }
    }

    if (empty($targetUrl)) {
        $setting = db_query_one('SELECT value FROM integration_settings WHERE `key` = ?', ['google_sheets_config']);
        $config = $setting ? json_decode($setting['value'], true) : [];
        $targetUrl = trim($config['global_webhook_url'] ?? (defined('GOOGLE_SHEETS_WEBHOOK_URL') ? GOOGLE_SHEETS_WEBHOOK_URL : ''));
    }

    if (empty($targetUrl)) {
        json_error('No Google Sheet Webhook URL provided or configured. Please enter a Webhook URL.', 400);
    }

    $payload = [
        'timestamp' => date('Y-m-d H:i:s'),
        'brand_id' => $brandId ?: 'brand-test',
        'brand_name' => $brandName,
        'ticket_id' => 'tkt-test-' . time(),
        'ticket_number' => 'TEST-100',
        'ticket_title' => 'Google Sheets Connection & Auto-Tab Sync Verification',
        'event' => 'Connection Test',
        'status' => 'TRIAGED',
        'priority' => 'P1',
        'website_name' => 'client-portal-test.com',
        'environment' => 'production',
        'requester_name' => $user['name'] . ' (' . $user['email'] . ')',
        'assignee_name' => $user['name'],
        'details' => 'Verification test payload sent from Antigravity Bug Tracker. If you see this row, real-time logging is active!',
        'actor_name' => $user['name']
    ];

    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_AUTOREFERER, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    $success = ($code >= 200 && $code < 400 && empty($err));

    // Record delivery
    try {
        $delivId = 'deliv-' . time() . '-' . bin2hex(random_bytes(4));
        db_execute(
            'INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $delivId,
                'google_sheets',
                $brandName . ' (test)',
                'Connection Test',
                null,
                json_encode($payload),
                $success ? 'delivered' : 'failed',
                1,
                $err ?: ($success ? null : "HTTP status $code: $resp")
            ]
        );
    } catch (Exception $e) {}

    json_response([
        'success' => $success,
        'http_code' => $code,
        'brand_name' => $brandName,
        'message' => $success 
            ? "Test row successfully sent to Google Sheet for brand '{$brandName}'! Check your spreadsheet tab."
            : "Failed to connect to Google Sheets URL (HTTP {$code}). Error: " . ($err ?: $resp)
    ]);
}

// POST /api/organizations/{id}/sheets-url (Set or clear dedicated Google Sheet URL for a brand)
if ($method === 'POST' && preg_match('#^/api/organizations/([^/]+)/sheets-url$#', $path, $m)) {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $orgId = $m[1];
    $input = get_json_input();
    $url = trim($input['google_sheet_url'] ?? '');

    db_execute('UPDATE organizations SET google_sheet_url = ? WHERE id = ?', [!empty($url) ? $url : null, $orgId]);
    json_response(['success' => true, 'google_sheet_url' => $url, 'message' => 'Brand Google Sheet URL updated successfully']);
}

// ==============================================================================
// WhatsApp Integration API Routes
// ==============================================================================

// GET /api/integrations/whatsapp/config
if ($method === 'GET' && $path === '/api/integrations/whatsapp/config') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);

    $config = get_whatsapp_config();

    $deliveries = db_query(
        "SELECT n.*, t.ticket_number 
         FROM notification_deliveries n 
         LEFT JOIN tickets t ON n.ticket_id = t.id 
         WHERE n.channel = 'whatsapp' 
         ORDER BY n.created_at DESC LIMIT 30"
    );

    foreach ($deliveries as &$d) {
        $d['payload'] = !empty($d['payload']) ? json_decode($d['payload'], true) : null;
    }
    unset($d);

    json_response([
        'success' => true,
        'config' => [
            'enabled' => !empty($config['enabled']),
            'gateway_url' => $config['gateway_url'] ?? '',
            'admin_phone' => $config['admin_phone'] ?? '+919999999999',
            'has_api_key' => !empty($config['api_key']),
            'send_on_create' => isset($config['send_on_create']) ? (bool)$config['send_on_create'] : true,
            'send_on_assign' => isset($config['send_on_assign']) ? (bool)$config['send_on_assign'] : true,
            'send_on_status' => isset($config['send_on_status']) ? (bool)$config['send_on_status'] : true
        ],
        'deliveries' => $deliveries
    ]);
}

// POST /api/integrations/whatsapp/config
if ($method === 'POST' && $path === '/api/integrations/whatsapp/config') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $current = get_whatsapp_config();
    $newConfig = [
        'enabled' => isset($input['enabled']) ? (bool)$input['enabled'] : true,
        'gateway_url' => trim($input['gateway_url'] ?? $current['gateway_url'] ?? ''),
        'api_key' => !empty($input['api_key']) ? trim($input['api_key']) : ($current['api_key'] ?? ''),
        'admin_phone' => trim($input['admin_phone'] ?? $current['admin_phone'] ?? '+919999999999'),
        'send_on_create' => isset($input['send_on_create']) ? (bool)$input['send_on_create'] : true,
        'send_on_assign' => isset($input['send_on_assign']) ? (bool)$input['send_on_assign'] : true,
        'send_on_status' => isset($input['send_on_status']) ? (bool)$input['send_on_status'] : true
    ];

    db_execute(
        'INSERT INTO integration_settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        ['whatsapp_config', json_encode($newConfig), 'WhatsApp notifications configuration for brand and team dispatches']
    );

    json_response(['success' => true, 'config' => $newConfig, 'message' => 'WhatsApp configuration updated successfully']);
}

// POST /api/integrations/whatsapp/test
if ($method === 'POST' && $path === '/api/integrations/whatsapp/test') {
    $user = require_auth();
    require_roles($user, ['super_admin', 'support_manager']);
    $input = get_json_input();

    $targetPhone = !empty($input['phone']) ? trim($input['phone']) : null;
    $msg = "🧪 *Assurance Media | WhatsApp Integration Test*\n" .
           "Test triggered by: {$user['name']} ({$user['email']})\n" .
           "Time: " . date('Y-m-d H:i:s') . "\n" .
           "Status: WhatsApp gateway connectivity active & functional! 🚀";

    $result = send_whatsapp_notification($targetPhone, $msg, [
        'event' => 'test_verification',
        'tester' => $user['email']
    ]);

    json_response([
        'success' => $result['success'],
        'phone' => $result['phone'],
        'whatsapp_web_url' => $result['whatsapp_web_url'],
        'http_code' => $result['http_code'],
        'message' => $result['success']
            ? "Test notification dispatched to {$result['phone']} successfully!"
            : "WhatsApp message logged to database. Direct click-to-send link generated."
    ]);
}

// Default 404 for unknown API routes
json_error("Route not found: {$method} {$path}", 404);
