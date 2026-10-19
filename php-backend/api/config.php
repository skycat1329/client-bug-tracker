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
define('EMAIL_FROM', 'irfan@assurancemedia.in');
define('EMAIL_FROM_NAME', 'Client Bug Tracker');

// SMTP Settings (Google Workspace / Gmail for assurancemedia.in)
// Set to true to deliver authenticated emails directly via Google's SMTP servers
define('SMTP_ENABLED', true);
define('SMTP_HOST', 'smtp.gmail.com');          // assurancemedia.in is hosted on Google Workspace
define('SMTP_PORT', 465);                       // 465 (SSL) or 587 (TLS)
define('SMTP_USER', 'irfan@assurancemedia.in'); // Google Workspace Email
define('SMTP_PASS', 'YOUR_GOOGLE_APP_PASSWORD'); // 16-character Google App Password (e.g. abcd efgh ijkl mnop)

// Slack Incoming Webhook (Optional, leave empty if not yet configured)
define('SLACK_WEBHOOK_URL', '');

// Channels for Slack notifications
define('SLACK_CHANNEL_BUG_REPORTS', '#client-bug-reports');
define('SLACK_CHANNEL_DEV_TRIAGE', '#dev-triage');
define('SLACK_CHANNEL_INCIDENTS', '#production-incidents');
define('SLACK_CHANNEL_RESOLUTIONS', '#ticket-resolutions');

// Google Sheets Webhook URL (Optional global fallback, or configure dynamically in Web UI)
define('GOOGLE_SHEETS_WEBHOOK_URL', '');

// Storage directory for attachments
define('UPLOAD_DIR', __DIR__ . '/../uploads');
if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}
