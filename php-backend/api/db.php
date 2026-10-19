<?php
// ==============================================================================
// Database Connection Layer (MySQL PDO)
// ==============================================================================

require_once __DIR__ . '/config.php';

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, (int)DB_PORT, DB_NAME);
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Database connection failed: ' . $e->getMessage()
            ]);
            exit;
        }
    }
    return $pdo;
}

function db_query(string $sql, array $params = []): array {
    $stmt = get_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function db_query_one(string $sql, array $params = []): ?array {
    $stmt = get_db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row !== false ? $row : null;
}

function db_execute(string $sql, array $params = []): int {
    $stmt = get_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function db_last_id(): string {
    return get_db()->lastInsertId();
}
