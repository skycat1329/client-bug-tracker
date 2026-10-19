import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { execute, getNextTicketNumber, query, queryOne } from '../../db/database.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { SlackNotificationService } from '../../notifications/slack.service.js';
import { EmailNotificationService } from '../../notifications/email.service.js';
import { Ticket, TicketPriority, TicketStatus } from '../../types/index.js';

export const ticketsRouter = Router();

// Validation schemas
const createTicketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(1, 'Description is required'),
  website_id: z.string().min(1, 'Website is required'),
  organization_id: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).default('P3'),
  steps_to_reproduce: z.string().optional().nullable(),
  browser: z.string().optional().nullable(),
  device: z.string().optional().nullable(),
  environment: z.string().optional().nullable().default('production'),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'NEW',
    'TRIAGED',
    'ASSIGNED',
    'IN PROGRESS',
    'WAITING FOR CLIENT',
    'FIX READY FOR TESTING',
    'RESOLVED',
    'CLOSED',
  ]),
  notes: z.string().optional(),
  root_cause: z.string().optional(),
  fix_details: z.string().optional(),
  resolution_notes: z.string().optional(),
});

const assignTicketSchema = z.object({
  assignee_id: z.string().min(1),
  notes: z.string().optional(),
});

// Calculate target response and resolution times
function calculateSLAs(priority: TicketPriority): {
  targetResponse: string;
  targetResolution: string;
} {
  const now = Date.now();
  const hours = {
    P1: { response: 1, resolution: 4 },
    P2: { response: 4, resolution: 24 },
    P3: { response: 8, resolution: 48 },
    P4: { response: 24, resolution: 120 },
  }[priority];

  return {
    targetResponse: new Date(now + hours.response * 3600000).toISOString(),
    targetResolution: new Date(now + hours.resolution * 3600000).toISOString(),
  };
}

// GET /api/tickets/export/csv (Must precede /:id)
ticketsRouter.get(
  '/export/csv',
  authenticate,
  requireRoles('super_admin', 'support_manager', 'developer'),
  async (req, res, next) => {
    try {
      const tickets = await query<Ticket>(
        `SELECT t.*, o.name as organization_name, w.name as website_name,
                req.name as requester_name, dev.name as assignee_name
         FROM tickets t
         JOIN organizations o ON t.organization_id = o.id
         JOIN websites w ON t.website_id = w.id
         JOIN users req ON t.requester_id = req.id
         LEFT JOIN users dev ON t.assignee_id = dev.id
         ORDER BY t.created_at DESC`
      );

      const headers = [
        'Ticket ID',
        'Title',
        'Organization',
        'Website',
        'Environment',
        'Category',
        'Priority',
        'Status',
        'Requester',
        'Assignee',
        'Created At',
        'Resolved At',
      ];

      const csvRows = [headers.join(',')];

      for (const t of tickets) {
        const row = [
          t.ticket_number,
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${(t.organization_name || '').replace(/"/g, '""')}"`,
          `"${(t.website_name || '').replace(/"/g, '""')}"`,
          t.environment,
          `"${(t.category || '').replace(/"/g, '""')}"`,
          t.priority,
          t.status,
          `"${(t.requester_name || '').replace(/"/g, '""')}"`,
          `"${(t.assignee_name || 'Unassigned').replace(/"/g, '""')}"`,
          t.created_at,
          t.resolved_at || '',
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tickets-export.csv"');
      res.send(csvRows.join('\n'));
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tickets
ticketsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const {
      status,
      priority,
      category,
      website_id,
      organization_id,
      assignee_id,
      search,
      my_assigned,
    } = req.query;

    let sql = `
      SELECT t.id, t.ticket_number, t.organization_id, t.website_id, t.requester_id,
             t.title, t.description, t.steps_to_reproduce, t.browser, t.device,
             t.environment, t.category, t.priority, t.status, t.assignee_id,
             t.source, t.target_response_time, t.target_resolution_time,
             t.resolved_at, t.closed_at, t.created_at, t.updated_at,
             o.name as organization_name,
             w.name as website_name, w.url as website_url,
             req.name as requester_name, req.email as requester_email,
             dev.name as assignee_name, dev.email as assignee_email
      FROM tickets t
      JOIN organizations o ON t.organization_id = o.id
      JOIN websites w ON t.website_id = w.id
      JOIN users req ON t.requester_id = req.id
      LEFT JOIN users dev ON t.assignee_id = dev.id
      WHERE 1=1
    `;
    const args: any[] = [];

    // Client organization isolation
    if (user.role === 'client') {
      sql += ' AND t.organization_id = ?';
      args.push(user.organizationId);
    } else if (organization_id) {
      sql += ' AND t.organization_id = ?';
      args.push(organization_id);
    }

    // Triage Visibility Policy:
    // If ticket is NEW, only visible to triagers (super_admin / support_manager) or assignee,
    // unless admin enabled all-team visibility
    if (user.role !== 'client') {
      const policySetting = await queryOne<{ value: string }>(
        'SELECT value FROM integration_settings WHERE key = ?',
        ['triage_visibility_policy']
      );
      const policy = policySetting
        ? JSON.parse(policySetting.value)
        : { triage_required_for_team: true, allowed_roles: ['super_admin', 'support_manager'] };

      const isExempt = (policy.allowed_roles || ['super_admin', 'support_manager']).includes(user.role);
      if (policy.triage_required_for_team && !isExempt) {
        sql += " AND (t.status != 'NEW' OR t.assignee_id = ?)";
        args.push(user.userId);
      }
    }

    if (status) {
      sql += ' AND t.status = ?';
      args.push(status);
    }

    if (priority) {
      sql += ' AND t.priority = ?';
      args.push(priority);
    }

    if (category) {
      sql += ' AND t.category = ?';
      args.push(category);
    }

    if (website_id) {
      sql += ' AND t.website_id = ?';
      args.push(website_id);
    }

    if (assignee_id) {
      if (assignee_id === 'unassigned') {
        sql += ' AND t.assignee_id IS NULL';
      } else {
        sql += ' AND t.assignee_id = ?';
        args.push(assignee_id);
      }
    }

    if (my_assigned === 'true' && user.role === 'developer') {
      sql += ' AND t.assignee_id = ?';
      args.push(user.userId);
    }

    if (search && typeof search === 'string') {
      sql += ' AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.description LIKE ?)';
      const term = `%${search}%`;
      args.push(term, term, term);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tickets = await query<Ticket>(sql, args);

    // If internal staff, also include root cause and fix details
    if (user.role !== 'client') {
      const detailedTickets = await query<any>(
        `SELECT id, root_cause, fix_details, resolution_notes FROM tickets WHERE id IN (${tickets.map(() => '?').join(',') || "''"})`,
        tickets.map((t) => t.id)
      );
      const detailMap = new Map(detailedTickets.map((d) => [d.id, d]));
      for (const t of tickets) {
        const details = detailMap.get(t.id);
        if (details) {
          t.root_cause = details.root_cause;
          t.fix_details = details.fix_details;
          t.resolution_notes = details.resolution_notes;
        }
      }
    }

    res.json({ success: true, count: tickets.length, tickets });
  } catch (error) {
    next(error);
  }
});

// POST /api/tickets (Create new ticket)
ticketsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const data = createTicketSchema.parse(req.body);

    let organizationId = data.organization_id;

    // Strict organization enforcement for clients
    if (user.role === 'client') {
      organizationId = user.organizationId!;
      // Verify website belongs to client's organization
      const site = await queryOne('SELECT organization_id FROM websites WHERE id = ?', [data.website_id]);
      if (!site || site.organization_id !== organizationId) {
        throw new AppError('Invalid website selected for your organization.', 400);
      }
    } else {
      // For staff, derive organization_id from website if not provided
      if (!organizationId) {
        const site = await queryOne<{ organization_id: string }>(
          'SELECT organization_id FROM websites WHERE id = ?',
          [data.website_id]
        );
        if (!site) throw new AppError('Website not found', 404);
        organizationId = site.organization_id;
      }
    }

    // Generate atomic unique ticket number (e.g. WEB-1005)
    const ticketNumber = await getNextTicketNumber('WEB');
    const ticketId = `tkt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // SLA calculation
    const { targetResponse, targetResolution } = calculateSLAs(data.priority);

    // Apply default routing rules (check category or website match)
    const matchingRule = await queryOne<any>(
      `SELECT default_assignee_id FROM routing_rules
       WHERE is_active = 1
         AND (website_id = ? OR website_id IS NULL)
         AND (category = ? OR category IS NULL)
         AND (priority = ? OR priority IS NULL)
       ORDER BY (website_id IS NOT NULL) DESC, (category IS NOT NULL) DESC
       LIMIT 1`,
      [data.website_id, data.category, data.priority]
    );

    const initialAssigneeId = matchingRule ? matchingRule.default_assignee_id : null;
    const initialStatus: TicketStatus = initialAssigneeId ? 'ASSIGNED' : 'NEW';

    await execute(
      `INSERT INTO tickets (
        id, ticket_number, organization_id, website_id, requester_id,
        title, description, steps_to_reproduce, browser, device,
        environment, category, priority, status, assignee_id, source,
        target_response_time, target_resolution_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketId,
        ticketNumber,
        organizationId,
        data.website_id,
        user.userId,
        data.title,
        data.description,
        data.steps_to_reproduce || null,
        data.browser || null,
        data.device || null,
        data.environment,
        data.category,
        data.priority,
        initialStatus,
        initialAssigneeId,
        'portal',
        targetResponse,
        targetResolution,
      ]
    );

    // Record creation in activity ledger
    await execute(
      `INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        ticketId,
        user.userId,
        'CREATED',
        JSON.stringify({ ticket_number: ticketNumber, priority: data.priority, category: data.category }),
        0,
      ]
    );

    // If automatically routed, record assignment activity
    if (initialAssigneeId) {
      await execute(
        `INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          ticketId,
          null,
          'ASSIGNED',
          JSON.stringify({
            assignee_id: initialAssigneeId,
            reason: 'Automated routing rule',
          }),
          0,
        ]
      );
    }

    // Retrieve full hydrated ticket for response & notifications
    const createdTicket = await queryOne<Ticket>(
      `SELECT t.*, o.name as organization_name, w.name as website_name,
              req.name as requester_name, req.email as requester_email,
              dev.name as assignee_name, dev.email as assignee_email
       FROM tickets t
       JOIN organizations o ON t.organization_id = o.id
       JOIN websites w ON t.website_id = w.id
       JOIN users req ON t.requester_id = req.id
       LEFT JOIN users dev ON t.assignee_id = dev.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (createdTicket) {
      // Dispatch Slack Notification
      SlackNotificationService.notify({
        ticket: createdTicket,
        event: 'created',
        actorName: user.name,
      }).catch((err) => console.error('Slack notification error:', err));

      // Dispatch Email Confirmation to Client
      EmailNotificationService.notifyTicketCreated(
        createdTicket,
        user.email,
        user.name
      ).catch((err) => console.error('Email notification error:', err));

      // If developer assigned, notify developer by email
      if (createdTicket.assignee_email) {
        EmailNotificationService.notifyTicketAssigned(
          createdTicket,
          createdTicket.assignee_email,
          createdTicket.assignee_name || 'Developer'
        ).catch((err) => console.error('Developer assignment email error:', err));
      }
    }

    res.status(201).json({ success: true, ticket: createdTicket });
  } catch (error) {
    next(error);
  }
});

// GET /api/tickets/:id
ticketsRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const ticketId = req.params.id;

    const ticket = await queryOne<Ticket>(
      `SELECT t.*, o.name as organization_name, w.name as website_name, w.url as website_url,
              req.name as requester_name, req.email as requester_email,
              dev.name as assignee_name, dev.email as assignee_email
       FROM tickets t
       JOIN organizations o ON t.organization_id = o.id
       JOIN websites w ON t.website_id = w.id
       JOIN users req ON t.requester_id = req.id
       LEFT JOIN users dev ON t.assignee_id = dev.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    // STRICT ORGANIZATION ISOLATION
    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden: Access to another organization’s ticket is denied.', 403);
    }

    // Sanitize internal fields for client
    if (user.role === 'client') {
      ticket.root_cause = null;
      ticket.fix_details = null;
    }

    res.json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tickets/:id/status
ticketsRouter.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const ticketId = req.params.id;
    const { status, notes, root_cause, fix_details, resolution_notes } = updateStatusSchema.parse(req.body);

    const ticket = await queryOne<Ticket>(
      `SELECT t.*, o.name as organization_name, w.name as website_name,
              req.name as requester_name, req.email as requester_email,
              dev.name as assignee_name, dev.email as assignee_email
       FROM tickets t
       JOIN organizations o ON t.organization_id = o.id
       JOIN websites w ON t.website_id = w.id
       JOIN users req ON t.requester_id = req.id
       LEFT JOIN users dev ON t.assignee_id = dev.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    // Organization check
    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden: Access to another organization’s ticket is denied.', 403);
    }

    // Client permissions check:
    // Clients can ONLY confirm resolution (RESOLVED -> CLOSED) or reopen (RESOLVED -> IN PROGRESS)
    if (user.role === 'client') {
      const isConfirming = ticket.status === 'RESOLVED' && status === 'CLOSED';
      const isReopening = (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && status === 'IN PROGRESS';

      if (!isConfirming && !isReopening) {
        throw new AppError(
          `Forbidden: Clients cannot transition status from ${ticket.status} to ${status}. Clients may only confirm resolved issues or reopen persisted bugs.`,
          403
        );
      }
    }

    // Prepare timestamp updates
    const nowIso = new Date().toISOString();
    let resolvedAt = ticket.resolved_at;
    let closedAt = ticket.closed_at;

    if (status === 'RESOLVED') {
      resolvedAt = nowIso;
    } else if (status === 'CLOSED') {
      closedAt = nowIso;
    } else if (status === 'IN PROGRESS') {
      // Reopened
      resolvedAt = null;
      closedAt = null;
    }

    await execute(
      `UPDATE tickets
       SET status = ?, root_cause = COALESCE(?, root_cause),
           fix_details = COALESCE(?, fix_details),
           resolution_notes = COALESCE(?, resolution_notes),
           resolved_at = ?, closed_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        status,
        root_cause || null,
        fix_details || null,
        resolution_notes || null,
        resolvedAt,
        closedAt,
        nowIso,
        ticketId,
      ]
    );

    // Record activity
    await execute(
      `INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        ticketId,
        user.userId,
        'STATUS_CHANGED',
        JSON.stringify({
          from: ticket.status,
          to: status,
          notes: notes || undefined,
        }),
        0,
      ]
    );

    const updatedTicket = {
      ...ticket,
      status,
      resolved_at: resolvedAt,
      closed_at: closedAt,
      root_cause: root_cause || ticket.root_cause,
      fix_details: fix_details || ticket.fix_details,
      resolution_notes: resolution_notes || ticket.resolution_notes,
    };

    // Slack Notification
    SlackNotificationService.notify({
      ticket: updatedTicket,
      event: status === 'RESOLVED' ? 'resolved' : 'status_changed',
      actorName: user.name,
      notes: notes || (status === 'RESOLVED' ? resolution_notes : undefined),
    }).catch((err) => console.error('Slack status notification error:', err));

    // Email Notification on Resolution
    if (status === 'RESOLVED' && updatedTicket.requester_email) {
      EmailNotificationService.notifyTicketResolved(
        updatedTicket,
        updatedTicket.requester_email,
        updatedTicket.requester_name || 'Client'
      ).catch((err) => console.error('Resolution email notification error:', err));
    }

    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tickets/:id/assign
ticketsRouter.patch(
  '/:id/assign',
  authenticate,
  requireRoles('super_admin', 'support_manager', 'developer'),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const ticketId = req.params.id;
      const { assignee_id, notes } = assignTicketSchema.parse(req.body);

      // Verify assignee exists and is a developer or staff
      const dev = await queryOne<any>('SELECT id, name, email, role FROM users WHERE id = ?', [assignee_id]);
      if (!dev || !['developer', 'support_manager', 'super_admin'].includes(dev.role)) {
        throw new AppError('Invalid assignee: User must be an internal staff or developer.', 400);
      }

      const ticket = await queryOne<Ticket>(
        `SELECT t.*, o.name as organization_name, w.name as website_name,
                req.name as requester_name, req.email as requester_email
         FROM tickets t
         JOIN organizations o ON t.organization_id = o.id
         JOIN websites w ON t.website_id = w.id
         JOIN users req ON t.requester_id = req.id
         WHERE t.id = ?`,
        [ticketId]
      );

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      // Automatically advance status if NEW or TRIAGED
      const newStatus = ['NEW', 'TRIAGED'].includes(ticket.status) ? 'ASSIGNED' : ticket.status;

      await execute(
        "UPDATE tickets SET assignee_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
        [assignee_id, newStatus, ticketId]
      );

      // Record assignment history
      await execute(
        'INSERT INTO ticket_assignments (id, ticket_id, assigner_id, assignee_id, notes) VALUES (?, ?, ?, ?, ?)',
        [`asg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, ticketId, user.userId, assignee_id, notes || null]
      );

      // Record activity
      await execute(
        `INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          ticketId,
          user.userId,
          'ASSIGNED',
          JSON.stringify({
            assignee_id,
            assignee_name: dev.name,
            assigner_name: user.name,
            notes: notes || undefined,
          }),
          0,
        ]
      );

      const updatedTicket: Ticket = {
        ...ticket,
        assignee_id,
        assignee_name: dev.name,
        assignee_email: dev.email,
        status: newStatus,
      };

      // Slack notification
      SlackNotificationService.notify({
        ticket: updatedTicket,
        event: 'assigned',
        actorName: user.name,
        notes: notes || `Assigned to ${dev.name}`,
      }).catch((err) => console.error('Slack assign notification error:', err));

      // Email developer
      EmailNotificationService.notifyTicketAssigned(
        updatedTicket,
        dev.email,
        dev.name
      ).catch((err) => console.error('Developer assign email error:', err));

      res.json({ success: true, ticket: updatedTicket });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tickets/:id/duplicate-check
ticketsRouter.get('/:id/duplicate-check', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const ticketId = req.params.id;

    const current = await queryOne<Ticket>('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!current) throw new AppError('Ticket not found', 404);

    // Organization check
    if (user.role === 'client' && current.organization_id !== user.organizationId) {
      throw new AppError('Forbidden', 403);
    }

    // Find similar tickets (same website, same category or keywords in title)
    const words = current.title.split(' ').filter((w) => w.length > 3).slice(0, 3);
    const likeClauses = words.map(() => 'title LIKE ?').join(' OR ');
    const likeArgs = words.map((w) => `%${w}%`);

    const duplicates = await query<Ticket>(
      `SELECT id, ticket_number, title, status, priority, created_at
       FROM tickets
       WHERE id != ? AND organization_id = ?
         AND (website_id = ? OR category = ? ${likeClauses ? `OR (${likeClauses})` : ''})
       ORDER BY created_at DESC LIMIT 5`,
      [ticketId, current.organization_id, current.website_id, current.category, ...likeArgs]
    );

    res.json({ success: true, duplicates });
  } catch (error) {
    next(error);
  }
});
