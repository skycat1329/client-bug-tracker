import { Router } from 'express';
import { query, queryOne } from '../../db/database.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { NotificationDelivery, Ticket, TicketActivity } from '../../types/index.js';

export const auditRouter = Router();

// GET /api/tickets/:ticketId/activity
auditRouter.get('/tickets/:ticketId/activity', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const { ticketId } = req.params;

    const ticket = await queryOne<Ticket>('SELECT organization_id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden: Access to this ticket is denied.', 403);
    }

    let sql = `
      SELECT a.*, u.name as user_name
      FROM ticket_activity a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.ticket_id = ?
    `;
    const args: any[] = [ticketId];

    if (user.role === 'client') {
      sql += ' AND a.is_internal = 0';
    }

    sql += ' ORDER BY a.created_at DESC';

    const rawActivities = await query<any>(sql, args);
    const activities: TicketActivity[] = rawActivities.map((a) => ({
      ...a,
      is_internal: Boolean(a.is_internal),
      details: a.details ? JSON.parse(a.details) : null,
    }));

    res.json({ success: true, activities });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit-logs (Agency wide activity ledger for managers/admins)
auditRouter.get(
  '/logs',
  authenticate,
  requireRoles('super_admin', 'support_manager', 'developer'),
  async (req, res, next) => {
    try {
      const rawActivities = await query<any>(
        `SELECT a.*, u.name as user_name, t.ticket_number, t.title as ticket_title, o.name as organization_name
         FROM ticket_activity a
         LEFT JOIN users u ON a.user_id = u.id
         JOIN tickets t ON a.ticket_id = t.id
         JOIN organizations o ON t.organization_id = o.id
         ORDER BY a.created_at DESC
         LIMIT 100`
      );

      const logs = rawActivities.map((a) => ({
        ...a,
        is_internal: Boolean(a.is_internal),
        details: a.details ? JSON.parse(a.details) : null,
      }));

      res.json({ success: true, count: logs.length, logs });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/audit/tickets/:ticketId/export/csv (Per-ticket dedicated audit log CSV)
auditRouter.get(
  '/tickets/:ticketId/export/csv',
  authenticate,
  async (req, res, next) => {
    try {
      const user = req.user!;
      const { ticketId } = req.params;

      const ticket = await queryOne<Ticket>(
        `SELECT t.*, o.name as organization_name
         FROM tickets t
         JOIN organizations o ON t.organization_id = o.id
         WHERE t.id = ?`,
        [ticketId]
      );
      if (!ticket) throw new AppError('Ticket not found', 404);

      if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
        throw new AppError('Forbidden: Access denied', 403);
      }

      let sql = `
        SELECT a.created_at, a.action, a.details, a.is_internal, u.name as user_name, u.email as user_email
        FROM ticket_activity a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.ticket_id = ?
      `;
      if (user.role === 'client') {
        sql += ' AND a.is_internal = 0';
      }
      sql += ' ORDER BY a.created_at ASC';

      const raw = await query<any>(sql, [ticketId]);

      const headers = ['Timestamp', 'Action', 'Performed By', 'User Email', 'Visibility', 'Details'];
      const csvRows = [headers.join(',')];

      for (const row of raw) {
        let detailsText = '';
        if (row.details) {
          try {
            const parsed = JSON.parse(row.details);
            detailsText = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; ');
          } catch {
            detailsText = String(row.details);
          }
        }

        csvRows.push([
          `"${row.created_at}"`,
          `"${row.action}"`,
          `"${(row.user_name || 'System').replace(/"/g, '""')}"`,
          `"${(row.user_email || '').replace(/"/g, '""')}"`,
          row.is_internal ? '"Internal (Dev Only)"' : '"Public"',
          `"${detailsText.replace(/"/g, '""')}"`,
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticket.ticket_number}-log.csv"`);
      res.send(csvRows.join('\n'));
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/audit/export/brand/:orgId/csv (Per-brand dedicated ticket & log spreadsheet)
auditRouter.get(
  '/export/brand/:orgId/csv',
  authenticate,
  requireRoles('super_admin', 'support_manager', 'client', 'developer'),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const { orgId } = req.params;

      if (user.role === 'client' && user.organizationId !== orgId) {
        throw new AppError('Forbidden: Access to another brand is denied', 403);
      }

      const org = await queryOne<{ id: string; name: string }>('SELECT id, name FROM organizations WHERE id = ?', [orgId]);
      if (!org) throw new AppError('Brand organization not found', 404);

      const tickets = await query<any>(
        `SELECT t.ticket_number, t.title, t.priority, t.status, t.category,
                t.environment, t.created_at, t.resolved_at, t.closed_at,
                t.root_cause, t.fix_details,
                w.name as website_name, req.name as requester_name, dev.name as assignee_name
         FROM tickets t
         JOIN websites w ON t.website_id = w.id
         JOIN users req ON t.requester_id = req.id
         LEFT JOIN users dev ON t.assignee_id = dev.id
         WHERE t.organization_id = ?
         ORDER BY t.created_at DESC`,
        [orgId]
      );

      const headers = [
        'Ticket Reference',
        'Brand Organization',
        'Website',
        'Title',
        'Category',
        'Priority',
        'Status',
        'Environment',
        'Requester',
        'Assignee Specialist',
        'Created Date',
        'Resolved Date',
        'Root Cause',
        'Fix Details',
      ];
      const csvRows = [headers.join(',')];

      for (const t of tickets) {
        csvRows.push([
          `"${t.ticket_number}"`,
          `"${org.name.replace(/"/g, '""')}"`,
          `"${(t.website_name || '').replace(/"/g, '""')}"`,
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${(t.category || '').replace(/"/g, '""')}"`,
          `"${t.priority}"`,
          `"${t.status}"`,
          `"${t.environment}"`,
          `"${(t.requester_name || '').replace(/"/g, '""')}"`,
          `"${(t.assignee_name || 'Unassigned').replace(/"/g, '""')}"`,
          `"${t.created_at}"`,
          `"${t.resolved_at || ''}"`,
          `"${(t.root_cause || '').replace(/"/g, '""')}"`,
          `"${(t.fix_details || '').replace(/"/g, '""')}"`,
        ].join(','));
      }

      const safeOrgSlug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="brand-${safeOrgSlug}-tickets-log.csv"`);
      res.send(csvRows.join('\n'));
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/notifications (Slack and Email delivery records)
auditRouter.get(
  '/notifications',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const rawDeliveries = await query<any>(
        `SELECT n.*, t.ticket_number
         FROM notification_deliveries n
         LEFT JOIN tickets t ON n.ticket_id = t.id
         ORDER BY n.created_at DESC
         LIMIT 100`
      );

      const deliveries: NotificationDelivery[] = rawDeliveries.map((d) => ({
        ...d,
        payload: d.payload ? JSON.parse(d.payload) : null,
      }));

      res.json({ success: true, count: deliveries.length, deliveries });
    } catch (error) {
      next(error);
    }
  }
);
