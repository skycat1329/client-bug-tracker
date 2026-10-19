import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:local.db',

  // JWT Auth
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_antigravity_bug_tracker_998877',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Slack Integration
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  slackChannels: {
    bugReports: process.env.SLACK_CHANNEL_BUG_REPORTS || '#client-bug-reports',
    devTriage: process.env.SLACK_CHANNEL_DEV_TRIAGE || '#dev-triage',
    incidents: process.env.SLACK_CHANNEL_INCIDENTS || '#production-incidents',
    resolutions: process.env.SLACK_CHANNEL_RESOLUTIONS || '#ticket-resolutions',
  },

  // Email Integration
  emailProvider: process.env.EMAIL_PROVIDER || 'logger',
  emailFrom: process.env.EMAIL_FROM || 'support@webagency.example.com',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  resendApiKey: process.env.RESEND_API_KEY || '',

  // File Uploads
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10), // 10MB
  allowedMimeTypes: (
    process.env.ALLOWED_MIME_TYPES ||
    'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,text/plain'
  ).split(','),
};
