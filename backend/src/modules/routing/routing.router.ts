import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { execute, query, queryOne } from '../../db/database.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { RoutingRule } from '../../types/index.js';

export const routingRouter = Router();

const createRuleSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional().nullable(),
  website_id: z.string().optional().nullable(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional().nullable(),
  default_assignee_id: z.string().min(1),
  is_active: z.boolean().default(true),
});

// GET /api/routing-rules
routingRouter.get(
  '/',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const rules = await query<RoutingRule & { website_name?: string }>(
        `SELECT r.*, u.name as default_assignee_name, w.name as website_name
         FROM routing_rules r
         JOIN users u ON r.default_assignee_id = u.id
         LEFT JOIN websites w ON r.website_id = w.id
         ORDER BY r.created_at DESC`
      );

      res.json({ success: true, rules });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/routing-rules
routingRouter.post(
  '/',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const data = createRuleSchema.parse(req.body);

      const dev = await queryOne('SELECT id FROM users WHERE id = ?', [data.default_assignee_id]);
      if (!dev) throw new AppError('Default assignee user not found', 404);

      const ruleId = `rule-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await execute(
        `INSERT INTO routing_rules (id, name, category, website_id, priority, default_assignee_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ruleId,
          data.name,
          data.category || null,
          data.website_id || null,
          data.priority || null,
          data.default_assignee_id,
          data.is_active ? 1 : 0,
        ]
      );

      const created = await queryOne<RoutingRule>('SELECT * FROM routing_rules WHERE id = ?', [ruleId]);
      res.status(201).json({ success: true, rule: created });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/routing-rules/:id
routingRouter.delete(
  '/:id',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const ruleId = req.params.id;
      await execute('DELETE FROM routing_rules WHERE id = ?', [ruleId]);
      res.json({ success: true, message: 'Routing rule deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);
