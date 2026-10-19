import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { execute, query, queryOne } from '../../db/database.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { EmailNotificationService } from '../../notifications/email.service.js';
import { Ticket, TicketComment } from '../../types/index.js';

export const commentsRouter = Router({ mergeParams: true });

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty'),
  is_internal: z.boolean().default(false),
});

// GET /api/tickets/:ticketId/comments
commentsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const { ticketId } = req.params;

    // Verify ticket and organization access
    const ticket = await queryOne<Ticket>('SELECT organization_id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden: Access to this ticket is denied.', 403);
    }

    let sql = `
      SELECT c.id, c.ticket_id, c.user_id, c.is_internal, c.content, c.created_at,
             u.name as user_name, u.role as user_role, u.custom_role as user_custom_role,
             u.email as user_email, o.name as user_organization_name
      FROM ticket_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE c.ticket_id = ?
    `;
    const args: any[] = [ticketId];

    // STRICT PRIVACY: Clients NEVER see internal notes
    if (user.role === 'client') {
      sql += ' AND c.is_internal = 0';
    }

    sql += ' ORDER BY c.created_at ASC';

    const comments = await query<TicketComment>(sql, args);
    res.json({ success: true, count: comments.length, comments });
  } catch (error) {
    next(error);
  }
});

// POST /api/tickets/:ticketId/comments
commentsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const { ticketId } = req.params;
    const data = createCommentSchema.parse(req.body);

    const ticket = await queryOne<Ticket>(
      `SELECT t.*, req.email as requester_email, req.name as requester_name
       FROM tickets t
       JOIN users req ON t.requester_id = req.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (!ticket) throw new AppError('Ticket not found', 404);

    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden: Access to this ticket is denied.', 403);
    }

    // Clients can NEVER create internal notes
    let isInternal = data.is_internal;
    if (user.role === 'client') {
      isInternal = false;
    }

    const commentId = `com-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await execute(
      'INSERT INTO ticket_comments (id, ticket_id, user_id, is_internal, content) VALUES (?, ?, ?, ?, ?)',
      [commentId, ticketId, user.userId, isInternal ? 1 : 0, data.content]
    );

    // Record activity
    await execute(
      `INSERT INTO ticket_activity (id, ticket_id, user_id, action, details, is_internal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        ticketId,
        user.userId,
        isInternal ? 'INTERNAL_NOTE_ADDED' : 'PUBLIC_COMMENT_ADDED',
        JSON.stringify({ comment_id: commentId, preview: data.content.slice(0, 80) }),
        isInternal ? 1 : 0,
      ]
    );

    const createdComment = await queryOne<TicketComment>(
      `SELECT c.id, c.ticket_id, c.user_id, c.is_internal, c.content, c.created_at,
              u.name as user_name, u.role as user_role, u.email as user_email
       FROM ticket_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    // If staff posted a public comment, notify client via email
    if (!isInternal && user.role !== 'client' && ticket.requester_email) {
      EmailNotificationService.notifyTicketUpdated(
        ticket,
        ticket.requester_email,
        data.content
      ).catch((err) => console.error('Email update notification error:', err));
    }

    res.status(201).json({ success: true, comment: createdComment });
  } catch (error) {
    next(error);
  }
});
