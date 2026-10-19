import { Router } from 'express';
import { config } from '../../config/index.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { SlackNotificationService } from '../../notifications/slack.service.js';
import { query, queryOne, execute } from '../../db/database.js';

export const integrationsRouter = Router();

// GET /api/integrations/slack/health
integrationsRouter.get(
  '/slack/health',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const isConfigured = Boolean(config.slackWebhookUrl.trim());
    res.json({
      success: true,
      configured: isConfigured,
      webhookConfigured: isConfigured,
      mode: isConfigured ? 'live' : 'mock (safe local mode)',
      channels: config.slackChannels,
    });
  }
);

// POST /api/integrations/slack/test
integrationsRouter.post(
  '/slack/test',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const result = await SlackNotificationService.sendTestNotification();
    res.json(result);
  }
);

// POST /api/integrations/email/test
integrationsRouter.post(
  '/email/test',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const targetEmail = (req.body?.email || req.user!.email).trim();
    const result = await EmailNotificationService.sendEmail({
      to: targetEmail,
      subject: 'Test Email Notification - Client Bug Tracker',
      event: 'test_notification',
      text: `Hello,\n\nThis is a verification email sent from Client Bug Tracker to confirm that email notifications via ${config.emailFrom} are working correctly.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0176D3;">Email Integration Active</h2>
          <p>This is a verification test to confirm that your SMTP configuration is operational.</p>
          <p><strong>Sender:</strong> ${config.emailFrom}</p>
          <p><strong>Recipient:</strong> ${targetEmail}</p>
        </div>
      `,
    });
    res.json({
      success: result.success,
      recipient: targetEmail,
      sender: config.emailFrom,
      status: result.status,
      error: result.error,
      message: result.success
        ? `Test email sent successfully to ${targetEmail}!`
        : `Email delivery failed: ${result.error || 'Unknown error'}`,
    });
  }
);

// GET /api/integrations/sheets/config
integrationsRouter.get(
  '/sheets/config',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const setting = await queryOne<{ value: string }>('SELECT value FROM integration_settings WHERE key = ?', ['google_sheets_config']);
    const conf = setting ? JSON.parse(setting.value) : { enabled: false, global_webhook_url: '', create_brand_tabs: true };
    const brands = await query<any>('SELECT id, name, slug, google_sheet_url FROM organizations ORDER BY name ASC');
    const deliveries = await query<any>(
      `SELECT n.*, t.ticket_number
       FROM notification_deliveries n
       LEFT JOIN tickets t ON n.ticket_id = t.id
       WHERE n.channel = 'google_sheets'
       ORDER BY n.created_at DESC LIMIT 30`
    );
    res.json({ success: true, config: conf, brands, deliveries });
  }
);

// POST /api/integrations/sheets/config
integrationsRouter.post(
  '/sheets/config',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const { enabled, global_webhook_url, create_brand_tabs } = req.body;
    const conf = {
      enabled: Boolean(enabled),
      global_webhook_url: (global_webhook_url || '').trim(),
      create_brand_tabs: create_brand_tabs !== false,
    };
    await execute(
      'INSERT INTO integration_settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['google_sheets_config', JSON.stringify(conf), 'Configuration for automatic real-time Google Sheets logging per brand']
    );
    res.json({ success: true, config: conf, message: 'Google Sheets configuration saved successfully' });
  }
);

// POST /api/integrations/sheets/test
integrationsRouter.post(
  '/sheets/test',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res) => {
    const { brand_id, webhook_url } = req.body;
    let targetUrl = webhook_url;
    let brandName = 'All Brands Test';

    if (brand_id) {
      const org = await queryOne<any>('SELECT name, google_sheet_url FROM organizations WHERE id = ?', [brand_id]);
      if (org) {
        brandName = org.name;
        if (!targetUrl && org.google_sheet_url) {
          targetUrl = org.google_sheet_url;
        }
      }
    }

    if (!targetUrl) {
      const setting = await queryOne<{ value: string }>('SELECT value FROM integration_settings WHERE key = ?', ['google_sheets_config']);
      if (setting) {
        const parsed = JSON.parse(setting.value);
        targetUrl = parsed.global_webhook_url;
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'No Google Sheet Webhook URL provided or configured.' });
    }

    const payload = {
      timestamp: new Date().toISOString(),
      brand_id: brand_id || 'test-brand',
      brand_name: brandName,
      ticket_number: 'TEST-100',
      ticket_title: 'Google Sheets Connection & Auto-Tab Sync Verification',
      event: 'Connection Test',
      status: 'TRIAGED',
      priority: 'P1',
      website_name: 'client-portal-test.com',
      environment: 'production',
      requester_name: req.user!.email,
      assignee_name: req.user!.email,
      details: 'Verification test payload sent from Antigravity Bug Tracker. Real-time logging is active!',
      actor_name: req.user!.email,
    };

    try {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      res.json({
        success: resp.ok,
        http_code: resp.status,
        brand_name: brandName,
        message: resp.ok
          ? `Test row successfully sent to Google Sheet for brand '${brandName}'!`
          : `Google Sheet webhook returned status ${resp.status}`,
      });
    } catch (err: any) {
      res.json({ success: false, message: 'Failed to connect to Google Sheets URL: ' + err.message });
    }
  }
);
