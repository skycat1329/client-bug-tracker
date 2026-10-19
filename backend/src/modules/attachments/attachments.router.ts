import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execute, query, queryOne } from '../../db/database.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { upload } from '../../middleware/upload.js';
import { Ticket, TicketAttachment } from '../../types/index.js';

export const attachmentsRouter = Router({ mergeParams: true });

// POST /api/tickets/:ticketId/attachments
attachmentsRouter.post(
  '/',
  authenticate,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const { ticketId } = req.params;
      const file = req.file;

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const ticket = await queryOne<Ticket>('SELECT organization_id FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        // Clean up uploaded file if ticket not found
        if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError('Ticket not found', 404);
      }

      if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
        if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError('Forbidden: Access to this ticket is denied.', 403);
      }

      let isInternal = req.body.is_internal === 'true' || req.body.is_internal === true;
      if (user.role === 'client') {
        isInternal = false;
      }

      const attachmentId = `att-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await execute(
        `INSERT INTO ticket_attachments (
          id, ticket_id, comment_id, uploader_id, filename,
          stored_filename, file_path, file_size, mime_type, is_internal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attachmentId,
          ticketId,
          req.body.comment_id || null,
          user.userId,
          file.originalname,
          file.filename,
          file.path,
          file.size,
          file.mimetype,
          isInternal ? 1 : 0,
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
          'ATTACHMENT_ADDED',
          JSON.stringify({ filename: file.originalname, size: file.size }),
          isInternal ? 1 : 0,
        ]
      );

      const created = await queryOne<TicketAttachment>(
        `SELECT a.*, u.name as uploader_name
         FROM ticket_attachments a
         JOIN users u ON a.uploader_id = u.id
         WHERE a.id = ?`,
        [attachmentId]
      );

      res.status(201).json({ success: true, attachment: created });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tickets/:ticketId/attachments
attachmentsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const { ticketId } = req.params;

    const ticket = await queryOne<Ticket>('SELECT organization_id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (user.role === 'client' && ticket.organization_id !== user.organizationId) {
      throw new AppError('Forbidden', 403);
    }

    let sql = `
      SELECT a.*, u.name as uploader_name
      FROM ticket_attachments a
      JOIN users u ON a.uploader_id = u.id
      WHERE a.ticket_id = ?
    `;
    const args: any[] = [ticketId];

    if (user.role === 'client') {
      sql += ' AND a.is_internal = 0';
    }

    sql += ' ORDER BY a.created_at ASC';

    const attachments = await query<TicketAttachment>(sql, args);
    res.json({ success: true, attachments });
  } catch (error) {
    next(error);
  }
});

// Standalone download router
export const downloadRouter = Router();

// GET /api/attachments/:id/download
downloadRouter.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const attachmentId = req.params.id;

    const attachment = await queryOne<any>(
      `SELECT a.*, t.organization_id
       FROM ticket_attachments a
       JOIN tickets t ON a.ticket_id = t.id
       WHERE a.id = ?`,
      [attachmentId]
    );

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    // Organization check
    if (user.role === 'client') {
      if (attachment.organization_id !== user.organizationId) {
        throw new AppError('Forbidden: Access denied.', 403);
      }
      if (attachment.is_internal) {
        throw new AppError('Forbidden: Access to internal attachment is denied.', 403);
      }
    }

    if (!fs.existsSync(attachment.file_path)) {
      throw new AppError('File not found on storage server', 404);
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});
