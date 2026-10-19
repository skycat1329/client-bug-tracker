import crypto from 'crypto';
import { config } from '../config/index.js';
import { execute } from '../db/database.js';
import { Ticket } from '../types/index.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  ticketId?: string;
  event: string;
}

export class EmailNotificationService {
  /**
   * Core email dispatcher supporting logger mode, SMTP, or Resend
   */
  public static async sendEmail(options: EmailOptions): Promise<{
    success: boolean;
    status: 'delivered' | 'failed' | 'mocked';
    error?: string;
  }> {
    const deliveryId = `del-mail-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const provider = config.emailProvider;

    if (provider === 'logger') {
      console.log('================ [EMAIL NOTIFICATION LOG] ================');
      console.log(`To: ${options.to}`);
      console.log(`From: ${config.emailFrom}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Event: ${options.event}`);
      console.log(`Body: ${options.text}`);
      console.log('==========================================================');

      await execute(
        `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryId,
          'email',
          options.to,
          options.event,
          options.ticketId || null,
          JSON.stringify({ to: options.to, subject: options.subject, body: options.text }),
          'mocked',
          1,
          'Email logged in development mode (EMAIL_PROVIDER=logger)',
        ]
      );

      return { success: true, status: 'mocked' };
    }

    if (provider === 'resend') {
      if (!config.resendApiKey) {
        const error = 'RESEND_API_KEY is missing in environment variables.';
        await execute(
          `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [deliveryId, 'email', options.to, options.event, options.ticketId || null, JSON.stringify(options), 'failed', 1, error]
        );
        return { success: false, status: 'failed', error };
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.resendApiKey}`,
          },
          body: JSON.stringify({
            from: config.emailFrom,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend API error HTTP ${res.status}: ${body}`);
        }

        await execute(
          `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [deliveryId, 'email', options.to, options.event, options.ticketId || null, JSON.stringify(options), 'delivered', 1, null]
        );

        return { success: true, status: 'delivered' };
      } catch (err: any) {
        await execute(
          `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [deliveryId, 'email', options.to, options.event, options.ticketId || null, JSON.stringify(options), 'failed', 1, err.message]
        );
        return { success: false, status: 'failed', error: err.message };
      }
    }

    // Default if unconfigured provider
    return {
      success: false,
      status: 'failed',
      error: `Unsupported or unconfigured email provider: ${provider}`,
    };
  }

  public static async notifyTicketCreated(ticket: Ticket, recipientEmail: string, recipientName: string) {
    const portalUrl = `${config.appUrl}/portal/tickets/${ticket.id}`;
    return this.sendEmail({
      to: recipientEmail,
      subject: `[${ticket.ticket_number}] Bug Report Received: ${ticket.title}`,
      event: 'ticket_created',
      ticketId: ticket.id,
      text: `Hello ${recipientName},\n\nWe have received your bug report for ${ticket.website_name || 'your website'}.\nYour ticket reference is: ${ticket.ticket_number}\nPriority: ${ticket.priority}\n\nYou can track updates and reply to our support team here:\n${portalUrl}\n\nBest regards,\nWeb Agency Support Team`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">Bug Report Received: ${ticket.ticket_number}</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>We have received your bug report for <strong>${ticket.website_name || 'your website'}</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
            <p style="margin: 0 0 8px;"><strong>Priority:</strong> ${ticket.priority}</p>
            <p style="margin: 0;"><strong>Category:</strong> ${ticket.category}</p>
          </div>
          <p><a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px;">View Ticket in Portal</a></p>
        </div>
      `,
    });
  }

  public static async notifyTicketAssigned(ticket: Ticket, developerEmail: string, developerName: string) {
    const internalUrl = `${config.appUrl}/internal/tickets/${ticket.id}`;
    return this.sendEmail({
      to: developerEmail,
      subject: `[Assignment] ${ticket.ticket_number}: ${ticket.title}`,
      event: 'ticket_assigned',
      ticketId: ticket.id,
      text: `Hello ${developerName},\n\nYou have been assigned to ticket ${ticket.ticket_number} (${ticket.priority}).\nTitle: ${ticket.title}\n\nView ticket:\n${internalUrl}`,
      html: `<p>Hello ${developerName},</p><p>You have been assigned to ticket <strong>${ticket.ticket_number}</strong> (${ticket.priority}).</p><p><a href="${internalUrl}">View Ticket Details</a></p>`,
    });
  }

  public static async notifyTicketUpdated(ticket: Ticket, recipientEmail: string, messagePreview: string) {
    const portalUrl = `${config.appUrl}/portal/tickets/${ticket.id}`;
    return this.sendEmail({
      to: recipientEmail,
      subject: `[Update] ${ticket.ticket_number}: New comment added`,
      event: 'ticket_comment_added',
      ticketId: ticket.id,
      text: `Hello,\n\nA new update has been posted to ticket ${ticket.ticket_number}:\n\n"${messagePreview}"\n\nView ticket:\n${portalUrl}`,
      html: `<p>Hello,</p><p>A new update has been posted to ticket <strong>${ticket.ticket_number}</strong>:</p><blockquote>${messagePreview}</blockquote><p><a href="${portalUrl}">Reply in Customer Portal</a></p>`,
    });
  }

  public static async notifyTicketResolved(ticket: Ticket, recipientEmail: string, recipientName: string) {
    const portalUrl = `${config.appUrl}/portal/tickets/${ticket.id}`;
    return this.sendEmail({
      to: recipientEmail,
      subject: `[Resolved] ${ticket.ticket_number}: ${ticket.title}`,
      event: 'ticket_resolved',
      ticketId: ticket.id,
      text: `Hello ${recipientName},\n\nYour bug report ${ticket.ticket_number} has been resolved by our development team.\n\nPlease test the fix on your website and confirm resolution, or reply if the issue persists:\n${portalUrl}\n\nBest regards,\nWeb Agency Support Team`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #059669;">Issue Resolved: ${ticket.ticket_number}</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Your bug report <strong>${ticket.ticket_number}</strong> has been marked as <strong>RESOLVED</strong> by our engineering team.</p>
          <p>Please test the fix and confirm if everything is working smoothly.</p>
          <p><a href="${portalUrl}" style="display: inline-block; background: #059669; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px;">Confirm or Reopen Ticket</a></p>
        </div>
      `,
    });
  }

  public static async notifyUserCredentials(
    recipientEmail: string,
    recipientName: string,
    password: string,
    roleTitle: string
  ) {
    const loginUrl = `${config.appUrl}/login`;
    return this.sendEmail({
      to: recipientEmail,
      subject: `Welcome to Client Bug Tracker - Your Login Credentials`,
      event: 'user_credentials_created',
      text: `Hello ${recipientName},\n\nAn account has been created for you on the Client Bug Tracker (${roleTitle}).\n\nLogin Email: ${recipientEmail}\nPassword: ${password}\n\nSign in at: ${loginUrl}\n\nPlease change your password after logging in for the first time.\n\nBest regards,\nWeb Agency Support Team`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #0176D3; padding: 20px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">Client Bug Tracker</h2>
          </div>
          <div style="padding: 24px;">
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>An account has been created for you on the <strong>Client Bug Tracker</strong> with the role: <strong>${roleTitle}</strong>.</p>
            <div style="background: #f1f5f9; border-left: 4px solid #0176D3; padding: 14px; border-radius: 6px; margin: 18px 0;">
              <p style="margin: 0 0 6px;"><strong>Login Email:</strong> <code style="color: #0176D3;">${recipientEmail}</code></p>
              <p style="margin: 0;"><strong>Password:</strong> <code style="color: #0176D3;">${password}</code></p>
            </div>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${loginUrl}" style="background: #0176D3; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Log In to Bug Tracker</a>
            </p>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;"><em>Please change your password after your first login.</em></p>
          </div>
        </div>
      `,
    });
  }
}

