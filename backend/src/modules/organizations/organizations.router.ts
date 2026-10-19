import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { execute, query, queryOne } from '../../db/database.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { Organization, Website } from '../../types/index.js';

export const organizationsRouter = Router();

const createOrgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
});

const createWebsiteSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
});

// GET /api/organizations
organizationsRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    let orgs: Organization[];

    if (user.role === 'client') {
      orgs = await query<Organization>(
        'SELECT * FROM organizations WHERE id = ? ORDER BY name ASC',
        [user.organizationId]
      );
    } else {
      orgs = await query<Organization>('SELECT * FROM organizations ORDER BY name ASC');
    }

    res.json({ success: true, organizations: orgs });
  } catch (error) {
    next(error);
  }
});

// POST /api/organizations (admin / support manager)
organizationsRouter.post(
  '/',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const data = createOrgSchema.parse(req.body);
      const slug =
        data.slug ||
        data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const existing = await queryOne('SELECT id FROM organizations WHERE slug = ?', [slug]);
      if (existing) {
        throw new AppError('An organization with this slug already exists.', 400);
      }

      const id = `org-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await execute('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)', [
        id,
        data.name,
        slug,
      ]);

      const org = await queryOne('SELECT * FROM organizations WHERE id = ?', [id]);
      res.status(201).json({ success: true, organization: org });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/organizations/:id/websites
organizationsRouter.get('/:id/websites', authenticate, async (req, res, next) => {
  try {
    const orgId = req.params.id;
    const user = req.user!;

    // Client organization isolation check
    if (user.role === 'client' && user.organizationId !== orgId) {
      throw new AppError('Forbidden: Access to another organization’s websites is denied.', 403);
    }

    const websites = await query<Website>(
      'SELECT * FROM websites WHERE organization_id = ? ORDER BY name ASC',
      [orgId]
    );

    res.json({ success: true, websites });
  } catch (error) {
    next(error);
  }
});

// POST /api/organizations/:id/websites
organizationsRouter.post(
  '/:id/websites',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const orgId = req.params.id;
      const data = createWebsiteSchema.parse(req.body);

      const org = await queryOne('SELECT id FROM organizations WHERE id = ?', [orgId]);
      if (!org) {
        throw new AppError('Organization not found', 404);
      }

      const websiteId = `site-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await execute(
        'INSERT INTO websites (id, organization_id, name, url, environment) VALUES (?, ?, ?, ?, ?)',
        [websiteId, orgId, data.name, data.url, data.environment]
      );

      const site = await queryOne('SELECT * FROM websites WHERE id = ?', [websiteId]);
      res.status(201).json({ success: true, website: site });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/websites (all websites accessible to current user)
organizationsRouter.get('/all-websites', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    let websites: (Website & { organization_name: string })[];

    if (user.role === 'client') {
      websites = await query<Website & { organization_name: string }>(
        `SELECT w.*, o.name as organization_name
         FROM websites w
         JOIN organizations o ON w.organization_id = o.id
         WHERE w.organization_id = ?
         ORDER BY w.name ASC`,
        [user.organizationId]
      );
    } else {
      websites = await query<Website & { organization_name: string }>(
        `SELECT w.*, o.name as organization_name
         FROM websites w
         JOIN organizations o ON w.organization_id = o.id
         ORDER BY o.name ASC, w.name ASC`
      );
    }

    res.json({ success: true, websites });
  } catch (error) {
    next(error);
  }
});

// POST /api/organizations/:id/sheets-url
organizationsRouter.post(
  '/:id/sheets-url',
  authenticate,
  requireRoles('super_admin', 'support_manager'),
  async (req, res, next) => {
    try {
      const orgId = req.params.id;
      const { google_sheet_url } = req.body;
      await execute('UPDATE organizations SET google_sheet_url = ? WHERE id = ?', [
        google_sheet_url ? google_sheet_url.trim() : null,
        orgId,
      ]);
      res.json({ success: true, google_sheet_url, message: 'Brand Google Sheet URL updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);
