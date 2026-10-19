<?php
// ==============================================================================
// Pure PHP Lightweight SMTP Client (Zero External Dependencies)
// Supports SSL (Port 465) and STARTTLS (Port 587) for Hostinger / Gmail / Titan
// ==============================================================================

function send_smtp_email(string $to, string $subject, string $htmlBody, string $textBody = ''): array {
    if (!defined('SMTP_HOST') || empty(SMTP_HOST) || !defined('SMTP_USER') || empty(SMTP_USER)) {
        return ['success' => false, 'error' => 'SMTP not configured in api/config.php'];
    }

    $host = SMTP_HOST;
    $port = (int)(defined('SMTP_PORT') ? SMTP_PORT : 465);
    $user = SMTP_USER;
    $pass = str_replace(' ', '', SMTP_PASS);
    $from = defined('EMAIL_FROM') && !empty(EMAIL_FROM) ? EMAIL_FROM : $user;
    $fromName = defined('EMAIL_FROM_NAME') && !empty(EMAIL_FROM_NAME) ? EMAIL_FROM_NAME : 'Assurance Media';

    $socketHost = ($port === 465) ? 'ssl://' . $host : $host;
    $timeout = 15;

    $socket = @stream_socket_client($socketHost . ':' . $port, $errno, $errstr, $timeout);
    if (!$socket) {
        return ['success' => false, 'error' => "Cannot connect to SMTP server {$host}:{$port} - {$errstr} ({$errno})"];
    }

    stream_set_timeout($socket, $timeout);

    $read = function () use ($socket) {
        $response = '';
        while ($str = fgets($socket, 515)) {
            $response .= $str;
            if (substr($str, 3, 1) === ' ') break;
        }
        return $response;
    };

    $cmd = function (string $command, int $expectedCode = 250) use ($socket, $read) {
        fputs($socket, $command . "\r\n");
        $response = $read();
        $code = (int)substr($response, 0, 3);
        if ($expectedCode !== 0 && $code !== $expectedCode) {
            throw new Exception("SMTP Error: Expected {$expectedCode}, received: {$response}");
        }
        return $response;
    };

    try {
        $read(); // Read initial server greeting (220)
        $clientHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $cmd("EHLO {$clientHost}", 250);

        if ($port === 587) {
            $cmd("STARTTLS", 220);
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $cmd("EHLO {$clientHost}", 250);
        }

        // Authenticate via AUTH LOGIN
        $cmd("AUTH LOGIN", 334);
        $cmd(base64_encode($user), 334);
        $cmd(base64_encode($pass), 235);

        // Mail From & Rcpt To
        $cmd("MAIL FROM:<{$from}>", 250);
        $cmd("RCPT TO:<{$to}>", 250);

        // Send Data
        $cmd("DATA", 354);

        $boundary = "bnd_" . md5(uniqid((string)time(), true));
        $headers = [
            "From: {$fromName} <{$from}>",
            "Reply-To: <{$from}>",
            "To: <{$to}>",
            "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
            "Date: " . date('r'),
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
            "X-Mailer: ClientBugTracker/PHP"
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n";
        $message .= "--{$boundary}\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($textBody ?: strip_tags($htmlBody))) . "\r\n";
        $message .= "--{$boundary}\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($htmlBody)) . "\r\n";
        $message .= "--{$boundary}--\r\n.";

        $cmd($message, 250);
        $cmd("QUIT", 221);
        fclose($socket);

        return ['success' => true];
    } catch (Exception $e) {
        @fclose($socket);
        return ['success' => false, 'error' => $e->getMessage()];
    }
}
