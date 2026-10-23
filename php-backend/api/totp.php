<?php
// ==============================================================================
// Pure PHP RFC 6238 TOTP (Time-based One-Time Password) Implementation
// Zero external dependencies. Compatible with Google Authenticator, 1Password, Authy.
// ==============================================================================

/**
 * Base32 character set (RFC 4648)
 */
define('TOTP_BASE32_CHARS', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');

/**
 * Generate a random Base32 secret key.
 */
function totp_generate_secret(int $length = 16): string {
    $chars = TOTP_BASE32_CHARS;
    $secret = '';
    $bytes = random_bytes($length);
    for ($i = 0; $i < $length; $i++) {
        $secret .= $chars[ord($bytes[$i]) % 32];
    }
    return $secret;
}

/**
 * Decode a Base32 string to binary bytes.
 */
function totp_base32_decode(string $b32): string {
    $b32 = strtoupper(trim($b32));
    $b32 = preg_replace('/[^A-Z2-7]/', '', $b32);
    if (empty($b32)) return '';

    $chars = TOTP_BASE32_CHARS;
    $buffer = 0;
    $bitsLeft = 0;
    $binary = '';

    for ($i = 0; $i < strlen($b32); $i++) {
        $val = strpos($chars, $b32[$i]);
        if ($val === false) continue;

        $buffer = ($buffer << 5) | $val;
        $bitsLeft += 5;

        if ($bitsLeft >= 8) {
            $bitsLeft -= 8;
            $binary .= chr(($buffer >> $bitsLeft) & 0xFF);
        }
    }

    return $binary;
}

/**
 * Calculate the TOTP code for a secret and timestamp.
 */
function totp_get_code(string $secret, ?int $timestamp = null, int $digits = 6, int $period = 30): string {
    if ($timestamp === null) {
        $timestamp = time();
    }

    $timeSlice = (int) floor($timestamp / $period);

    // Pack into 8-byte big-endian binary (portable for 32/64 bit PHP)
    $high = (int) ($timeSlice >> 32);
    $low = (int) ($timeSlice & 0xFFFFFFFF);
    $timeBytes = pack('NN', $high, $low);

    $secretBytes = totp_base32_decode($secret);
    if (empty($secretBytes)) {
        return '';
    }

    // HMAC-SHA1 per RFC 6238
    $hash = hash_hmac('sha1', $timeBytes, $secretBytes, true);

    // Dynamic truncation
    $offset = ord(substr($hash, -1)) & 0x0F;
    $part = substr($hash, $offset, 4);
    $value = unpack('N', $part)[1] & 0x7FFFFFFF;

    $modulo = pow(10, $digits);
    $code = $value % $modulo;

    return str_pad((string) $code, $digits, '0', STR_PAD_LEFT);
}

/**
 * Verify a TOTP code against a secret with a time-drift window.
 * Default discrepancy = 1 allows code from previous, current, or next 30-sec step.
 */
function totp_verify(string $secret, string $code, int $discrepancy = 1, ?int $timestamp = null, int $digits = 6, int $period = 30): bool {
    $code = trim($code);
    if (strlen($code) !== $digits) {
        return false;
    }

    if ($timestamp === null) {
        $timestamp = time();
    }

    for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
        $calcTime = $timestamp + ($i * $period);
        $calculatedCode = totp_get_code($secret, $calcTime, $digits, $period);
        if (hash_equals($calculatedCode, $code)) {
            return true;
        }
    }

    return false;
}

/**
 * Generate standard otpauth:// URI for QR codes.
 */
function totp_get_provisioning_uri(string $secret, string $accountName, string $issuer = 'Assurance Media'): string {
    $cleanSecret = strtoupper(trim($secret));
    $label = rawurlencode($issuer) . ':' . rawurlencode($accountName);
    return 'otpauth://totp/' . $label . '?secret=' . $cleanSecret . '&issuer=' . rawurlencode($issuer) . '&algorithm=SHA1&digits=6&period=30';
}
