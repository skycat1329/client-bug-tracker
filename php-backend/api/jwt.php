<?php
// ==============================================================================
// Pure PHP Lightweight JWT Implementation (HS256) - Zero Dependencies
// ==============================================================================

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + (4 - strlen($data) % 4), '=', STR_PAD_RIGHT));
}

function jwt_encode(array $payload, string $secret, int $exp_seconds = 2592000): string {
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $payload['iat'] = time();
    $payload['exp'] = time() + $exp_seconds;

    $header_encoded = base64url_encode(json_encode($header));
    $payload_encoded = base64url_encode(json_encode($payload));

    $signature = hash_hmac('sha256', "$header_encoded.$payload_encoded", $secret, true);
    $signature_encoded = base64url_encode($signature);

    return "$header_encoded.$payload_encoded.$signature_encoded";
}

function jwt_decode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    list($header_b64, $payload_b64, $sig_b64) = $parts;

    $header = json_decode(base64url_decode($header_b64), true);
    if (!$header || ($header['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $expected_sig = base64url_encode(hash_hmac('sha256', "$header_b64.$payload_b64", $secret, true));
    if (!hash_equals($expected_sig, $sig_b64)) {
        return null;
    }

    $payload = json_decode(base64url_decode($payload_b64), true);
    if (!$payload) {
        return null;
    }

    // Leeway of 120 seconds for clock drift
    if (isset($payload['exp']) && ($payload['exp'] + 120) < time()) {
        return null; // Expired
    }

    return $payload;
}
