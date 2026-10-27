<?php
// ==============================================================================
// Client Bug Tracker - PHP Configuration (Hostinger)
// ==============================================================================

// Database Credentials (Hostinger MySQL Database)
define('DB_HOST', 'localhost');
define('DB_NAME', 'u634780755_tracker_db');
define('DB_USER', 'u634780755_tracker_user');
define('DB_PASS', 'PurpleChiefPanda015');
define('DB_PORT', 3306);

// JWT Secret Key
define('JWT_SECRET', 'hostinger_production_secret_key_antigravity_998877');

// ==============================================================================
// Email / SMTP Sender Configuration
// ==============================================================================
// The sender email address shown to recipients
define('EMAIL_FROM', 'tools.assurance@gmail.com');
define('EMAIL_FROM_NAME', 'Assurance Media');

// SMTP Settings (Gmail for tools.assurance@gmail.com)
// Authenticated emails delivered directly via Google's SSL SMTP server (port 465)
define('SMTP_ENABLED', true);
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 465);
define('SMTP_USER', 'tools.assurance@gmail.com');
define('SMTP_PASS', 'qboa iaut xkct nwuj');

// Slack Incoming Webhook (Optional, leave empty if not yet configured)
define('SLACK_WEBHOOK_URL', '');

// Channels for Slack notifications
define('SLACK_CHANNEL_BUG_REPORTS', '#client-bug-reports');
define('SLACK_CHANNEL_DEV_TRIAGE', '#dev-triage');
define('SLACK_CHANNEL_INCIDENTS', '#production-incidents');
define('SLACK_CHANNEL_RESOLUTIONS', '#ticket-resolutions');

// Google Sheets Webhook URL (Optional global fallback, or configure dynamically in Web UI)
define('GOOGLE_SHEETS_WEBHOOK_URL', 'https://script.google.com/macros/s/AKfycbx_bw1Elm-2XQAt6pWB-zQKKOcBka5xkaJaOTlgOYFnH5se5MtgOFIx3QpjIEwmm3VALQ/exec');

// WhatsApp Gateway / Webhook Notification Settings
define('WHATSAPP_ENABLED', true);
define('WHATSAPP_GATEWAY_URL', '');
define('WHATSAPP_API_KEY', '');
define('WHATSAPP_DEFAULT_ADMIN_PHONE', '+919999999999');

// Storage directory for attachments
define('UPLOAD_DIR', __DIR__ . '/../uploads');
if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}
