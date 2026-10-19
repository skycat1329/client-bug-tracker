import crypto from 'crypto';
import { config } from '../config/index.js';
import { execute } from '../db/database.js';
import { Ticket, TicketPriority, TicketStatus } from '../types/index.js';

export interface SlackNotificationOptions {
  ticket: Ticket;
  event: 'created' | 'assigned' | 'status_changed' | 'resolved';
  actorName?: string;
  notes?: string;
}

export class SlackNotificationService {
  /**
   * Determine the target Slack channel based on ticket priority, status, and event
   */
  public static selectChannel(ticket: Ticket, event: string): string {
    if (ticket.priority === 'P1') {
      return config.slackChannels.incidents;
    }
    if (event === 'resolved' || ticket.status === 'RESOLVED') {
      return config.slackChannels.resolutions;
    }
    if (event === 'assigned' || ticket.status === 'TRIAGED') {
      return config.slackChannels.devTriage;
    }
    return config.slackChannels.bugReports;
  }

  /**
   * Build structured Slack Block Kit message payload
   */
  public static buildPayload(options: SlackNotificationOptions): {
    channel: string;
    text: string;
    blocks: any[];
  } {
    const { ticket, event, actorName, notes } = options;
    const channel = this.selectChannel(ticket, event);
    const dashboardUrl = `${config.appUrl}/internal/tickets/${ticket.id}`;

    // Color code and icon by priority
    const priorityEmoji = {
      P1: '🚨 *[P1 - CRITICAL]*',
      P2: '⚠️ *[P2 - HIGH]*',
      P3: 'ℹ️ *[P3 - NORMAL]*',
      P4: '☕ *[P4 - LOW]*',
    }[ticket.priority];

    const eventTitle = {
      created: `New Bug Report Created: ${ticket.ticket_number}`,
      assigned: `Ticket Assigned: ${ticket.ticket_number}`,
      status_changed: `Ticket Status Updated: ${ticket.ticket_number}`,
      resolved: `Ticket Resolved: ${ticket.ticket_number}`,
    }[event];

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${priorityEmoji.split(' ')[0]} ${eventTitle}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Ticket ID:*\n\`${ticket.ticket_number}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${priorityEmoji}`,
          },
          {
            type: 'mrkdwn',
            text: `*Brand / Client:*\n${ticket.organization_name || 'Organization'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Affected Website:*\n${ticket.website_name || 'Website'} (${ticket.environment || 'production'})`,
          },
          {
            type: 'mrkdwn',
            text: `*Category:*\n${ticket.category}`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Status:*\n\`${ticket.status}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title:*\n*${ticket.title}*\n\n*Description:*\n>${ticket.description.slice(0, 300)}${
            ticket.description.length > 300 ? '...' : ''
          }`,
        },
      },
    ];

    if (ticket.assignee_name) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Assigned Developer:*\n👤 ${ticket.assignee_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Updated By:*\n${actorName || 'System'}`,
          },
        ],
      });
    }

    if (notes) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Update Note:* ${notes}`,
          },
        ],
      });
    }

    // Action button to internal dashboard
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in Internal Dashboard',
            emoji: true,
          },
          url: dashboardUrl,
          style: ticket.priority === 'P1' ? 'danger' : 'primary',
        },
      ],
    });

    return {
      channel,
      text: `${priorityEmoji} [${ticket.ticket_number}] ${ticket.title} - Status: ${ticket.status}`,
      blocks,
    };
  }

  /**
   * Post notification to Slack Incoming Webhook with timeout, retries, and delivery logging
   */
  public static async notify(options: SlackNotificationOptions): Promise<{
    success: boolean;
    status: 'delivered' | 'failed' | 'mocked';
    channel: string;
    error?: string;
  }> {
    const payload = this.buildPayload(options);
    const deliveryId = `del-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const webhookUrl = config.slackWebhookUrl.trim();

    // If webhook is not configured, record as mocked delivery (safe local mode)
    if (!webhookUrl) {
      console.log(
        `[SlackNotificationService:Mock] Channel: ${payload.channel} | Event: ${options.event} | Ticket: ${options.ticket.ticket_number}`
      );

      await execute(
        `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryId,
          'slack',
          payload.channel,
          `ticket_${options.event}`,
          options.ticket.id,
          JSON.stringify(payload),
          'mocked',
          1,
          'SLACK_WEBHOOK_URL is not configured; simulated in dev mode',
        ]
      );

      return { success: true, status: 'mocked', channel: payload.channel };
    }

    // HTTP Dispatch with Retries and Exponential Backoff
    const maxAttempts = 3;
    let attempt = 0;
    let lastError = '';

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const respBody = await response.text();
          throw new Error(`Slack API responded with HTTP ${response.status}: ${respBody}`);
        }

        // Successfully delivered
        await execute(
          `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deliveryId,
            'slack',
            payload.channel,
            `ticket_${options.event}`,
            options.ticket.id,
            JSON.stringify(payload),
            'delivered',
            attempt,
            null,
          ]
        );

        return { success: true, status: 'delivered', channel: payload.channel };
      } catch (err: any) {
        lastError = err.message || String(err);
        console.warn(`[SlackNotificationService] Attempt ${attempt} failed: ${lastError}`);

        if (attempt < maxAttempts) {
          // Exponential backoff: 300ms, 600ms
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 150));
        }
      }
    }

    // Failed after all retries
    await execute(
      `INSERT INTO notification_deliveries (id, channel, recipient, event, ticket_id, payload, status, attempts, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deliveryId,
        'slack',
        payload.channel,
        `ticket_${options.event}`,
        options.ticket.id,
        JSON.stringify(payload),
        'failed',
        attempt,
        lastError,
      ]
    );

    return {
      success: false,
      status: 'failed',
      channel: payload.channel,
      error: lastError,
    };
  }

  /**
   * Health check / Test notification dispatcher
   */
  public static async sendTestNotification(): Promise<{
    configured: boolean;
    success: boolean;
    message: string;
  }> {
    if (!config.slackWebhookUrl.trim()) {
      return {
        configured: false,
        success: false,
        message: 'SLACK_WEBHOOK_URL is not set in backend environment variables.',
      };
    }

    const testPayload = {
      text: '🔔 *Slack Integration Test*: Connection between Client Bug Tracker and Slack verified successfully!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔔 *Slack Integration Test*\nConnection verified between *Client Bug Tracker API* and your workspace webhook.',
          },
        },
      ],
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(config.slackWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.text();
        return {
          configured: true,
          success: false,
          message: `Slack rejected webhook request: HTTP ${res.status} (${body})`,
        };
      }

      return {
        configured: true,
        success: true,
        message: 'Test notification sent to Slack successfully.',
      };
    } catch (err: any) {
      return {
        configured: true,
        success: false,
        message: `Network or timeout error contacting Slack: ${err.message}`,
      };
    }
  }
}
