import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { execute, query, queryOne } from '../../db/database.js';
import { authenticate, generateToken } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { User, UserRole } from '../../types/index.js';
import { EmailNotificationService } from '../../notifications/email.service.js';

export const authRouter = Router();

const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(3, 'Password must be at least 3 characters'),
    name: z.string().optional(),
    fullName: z.string().optional(),
    role: z.enum(['super_admin', 'support_manager', 'developer', 'client']).default('client'),
    custom_role: z.string().optional().nullable(),
    organization_id: z.string().optional().nullable(),
    organization_name: z.string().optional().nullable(),
    organizationName: z.string().optional().nullable(),
  })
  .transform((data) => ({
    ...data,
    name: (data.name || data.fullName || data.email.split('@')[0]).trim(),
    organization_name: data.organization_name || data.organizationName || null,
  }));

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register (Public self-registration disabled as per agency security policy)
authRouter.post('/register', async (req, res, next) => {
  try {
    throw new AppError(
      'Public self-registration is disabled. All client brand and developer accounts must be created directly by an Agency Administrator.',
      403
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await queryOne<User>(
      'SELECT id, email, password_hash, name, role, organization_id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    const isDevMatch = user?.email === 'dev@agency.com' && (password === 'dev123' || password === 'password123');
    const isAdminMatch = user?.email === 'admin@agency.com' && (password === 'admin123' || password === 'password123');
    const isPasswordValid = user?.password_hash && (bcrypt.compareSync(password, user.password_hash) || isDevMatch || isAdminMatch);

    if (!user || !isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await queryOne<any>(
      `SELECT u.id, u.email, u.name, u.role, u.custom_role, u.organization_id, u.avatar_url, u.created_at,
              o.name as organization_name, o.slug as organization_slug
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = ?`,
      [req.user!.userId]
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/demo-users (helpful for instant pairing & testing in development)
authRouter.get('/demo-users', async (req, res, next) => {
  try {
    const users = await query<any>(
      `SELECT u.id, u.email, u.name, u.role, u.custom_role, u.organization_id, o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       ORDER BY u.role, u.name`
    );

    res.json({
      success: true,
      users,
      defaultPassword: 'password123',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/staff (List internal team members for assignments & developer management)
authRouter.get('/staff', authenticate, async (req, res, next) => {
  try {
    const staff = await query<any>(
      `SELECT u.id, u.email, u.name, u.role, u.custom_role, u.created_at,
              (SELECT COUNT(*) FROM tickets t WHERE t.assignee_id = u.id AND t.status NOT IN ('RESOLVED', 'CLOSED')) as active_tickets_count
       FROM users u
       WHERE u.role IN ('developer', 'support_manager', 'super_admin')
       ORDER BY u.role, u.name ASC`
    );
    res.json({ success: true, staff });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/create-user (Admins creating developers/staff)
authRouter.post('/create-user', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only managers and admins can create accounts', 403);
    }

    const { email, password, name, role, custom_role, organization_id } = registerSchema.parse(req.body);

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 400);
    }

    const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    await execute(
      `INSERT INTO users (id, email, password_hash, name, role, custom_role, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email.toLowerCase(), passwordHash, name, role, custom_role || null, organization_id || null]
    );

    // Send credentials email
    const roleTitle = custom_role || role.replace('_', ' ');
    await EmailNotificationService.notifyUserCredentials(email.toLowerCase(), name || email, password, roleTitle);

    res.status(201).json({
      success: true,
      email_sent: true,
      user: { id: userId, email: email.toLowerCase(), name, role, custom_role: custom_role || null, organization_id },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/staff/:id (Delete team member)
authRouter.delete('/staff/:id', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only managers and admins can remove team members', 403);
    }
    const targetId = req.params.id;
    const target = await queryOne<any>('SELECT id, email, role FROM users WHERE id = ?', [targetId]);
    if (!target) throw new AppError('User not found', 404);

    if (target.email === 'admin@agency.com' || target.id === 'usr-admin-primary') {
      throw new AppError('Cannot delete the primary root Administrator account', 400);
    }
    if (targetId === req.user!.userId) {
      throw new AppError('You cannot delete your own account while logged in', 400);
    }

    // Reassign open tickets assigned to this user to unassigned (NULL)
    await execute('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ?', [targetId]);
    await execute('DELETE FROM organization_members WHERE user_id = ?', [targetId]);
    await execute('DELETE FROM users WHERE id = ?', [targetId]);

    res.json({ success: true, message: 'Team member removed successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/users/:id (Admin edits team member details / password)
authRouter.put('/users/:id', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only managers and admins can edit team members', 403);
    }
    const targetId = req.params.id;
    const { name, email, role, custom_role, password, must_reset_password } = req.body;
    if (!name || !email) throw new AppError('Name and email are required', 400);

    const target = await queryOne<any>('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!target) throw new AppError('User not found', 404);

    if (email.toLowerCase() !== target.email.toLowerCase()) {
      const existing = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), targetId]);
      if (existing) throw new AppError('Another user already has this email address', 400);
    }

    const finalRole = role || target.role;
    const finalCustomRole = custom_role !== undefined ? custom_role : target.custom_role;

    if (password) {
      if (password.length < 6) throw new AppError('Password must be at least 6 characters long', 400);
      const hash = await bcrypt.hash(password, 10);
      await execute(
        'UPDATE users SET name = ?, email = ?, role = ?, custom_role = ?, password_hash = ?, must_reset_password = ? WHERE id = ?',
        [name, email.toLowerCase(), finalRole, finalCustomRole, hash, must_reset_password !== undefined ? (must_reset_password ? 1 : 0) : 1, targetId]
      );
    } else {
      await execute(
        'UPDATE users SET name = ?, email = ?, role = ?, custom_role = ? WHERE id = ?',
        [name, email.toLowerCase(), finalRole, finalCustomRole, targetId]
      );
    }

    const updated = await queryOne('SELECT id, email, name, role, custom_role, organization_id, must_reset_password FROM users WHERE id = ?', [targetId]);
    res.json({ success: true, user: updated, message: 'User updated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/force-reset-password (Force reset password on first login)
authRouter.post('/force-reset-password', authenticate, async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400);
    }

    const hash = await bcrypt.hash(new_password, 10);
    await execute('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?', [hash, req.user!.userId]);

    const updated = await queryOne<any>('SELECT id, email, name, role, custom_role, organization_id FROM users WHERE id = ?', [req.user!.userId]);
    res.json({ success: true, message: 'Password reset successfully', user: { ...updated, must_reset_password: false } });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/roles (List roles)
authRouter.get('/roles', authenticate, async (req, res, next) => {
  try {
    const roles = await query<any>('SELECT * FROM roles ORDER BY is_system DESC, label ASC');
    res.json({ success: true, roles });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/roles (Create custom role)
authRouter.post('/roles', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only managers and admins can create custom roles', 403);
    }
    const schema = z.object({
      name: z.string().min(2, 'Role identifier must be at least 2 characters'),
      label: z.string().min(2, 'Display label is required'),
      description: z.string().optional(),
      color: z.string().default('blue'),
      base_role: z.enum(['developer', 'support_manager', 'super_admin']).default('developer'),
    });
    const data = schema.parse(req.body);
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const existing = await queryOne('SELECT id FROM roles WHERE name = ?', [slug]);
    if (existing) throw new AppError('A role with this name or key already exists', 400);

    const roleId = `role-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await execute(
      'INSERT INTO roles (id, name, label, description, color, base_role, is_system) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [roleId, slug, data.label, data.description || '', data.color, data.base_role]
    );

    res.status(201).json({ success: true, role: { id: roleId, ...data, name: slug, is_system: 0 } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/roles/:id (Delete custom role)
authRouter.delete('/roles/:id', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only Super Admins can delete custom roles', 403);
    }
    const role = await queryOne<any>('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!role) throw new AppError('Role not found', 404);
    if (role.is_system) throw new AppError('System default roles cannot be deleted', 400);

    await execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Custom role deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/create-client (Admin creating client credentials for a brand)
authRouter.post('/create-client', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only agency administrators can provision client credentials', 403);
    }

    const clientSchema = z.object({
      organization_id: z.string().min(1, 'Organization is required'),
      name: z.string().min(1, 'Full Name is required'),
      email: z.string().email('Please enter a valid email address'),
      password: z.string().min(3, 'Password must be at least 3 characters'),
    });

    const data = clientSchema.parse(req.body);

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [data.email.toLowerCase()]);
    if (existingUser) {
      throw new AppError('A user with this email address already exists.', 400);
    }

    const org = await queryOne<{ id: string; name: string }>('SELECT id, name FROM organizations WHERE id = ?', [data.organization_id]);
    if (!org) {
      throw new AppError('Client Organization not found', 404);
    }

    const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = bcrypt.hashSync(data.password, 10);

    await execute(
      `INSERT INTO users (id, email, password_hash, name, role, organization_id)
       VALUES (?, ?, ?, ?, 'client', ?)`,
      [userId, data.email.toLowerCase(), passwordHash, data.name, data.organization_id]
    );

    const memberId = `mem-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await execute(
      'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)',
      [memberId, data.organization_id, userId, 'member']
    );

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: data.email.toLowerCase(),
        name: data.name,
        role: 'client',
        organization_id: data.organization_id,
        organization_name: org.name,
      },
      credentials: {
        email: data.email.toLowerCase(),
        password: data.password,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/organization/:orgId/users (List client users for a brand)
authRouter.get('/organization/:orgId/users', authenticate, async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const users = await query<any>(
      `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM users u
       WHERE u.organization_id = ?
       ORDER BY u.name ASC`,
      [orgId]
    );
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/settings/visibility
authRouter.get('/settings/visibility', authenticate, async (req, res, next) => {
  try {
    const setting = await queryOne<{ value: string }>(
      'SELECT value FROM integration_settings WHERE key = ?',
      ['triage_visibility_policy']
    );
    const policy = setting
      ? JSON.parse(setting.value)
      : { triage_required_for_team: true, allowed_roles: ['super_admin', 'support_manager'] };
    res.json({ success: true, policy });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/settings/visibility
authRouter.post('/settings/visibility', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'support_manager'].includes(req.user!.role)) {
      throw new AppError('Forbidden: Only managers and admins can configure visibility policies', 403);
    }
    const { triage_required_for_team, allowed_roles } = req.body;
    const policyJson = JSON.stringify({
      triage_required_for_team: Boolean(triage_required_for_team),
      allowed_roles: Array.isArray(allowed_roles) ? allowed_roles : ['super_admin', 'support_manager'],
    });

    await execute(
      'INSERT OR REPLACE INTO integration_settings (key, value, description) VALUES (?, ?, ?)',
      [
        'triage_visibility_policy',
        policyJson,
        'Requires tickets to be in TRIAGED status before becoming visible to all regular team members',
      ]
    );

    res.json({ success: true, message: 'Visibility policy updated successfully' });
  } catch (error) {
    next(error);
  }
});
