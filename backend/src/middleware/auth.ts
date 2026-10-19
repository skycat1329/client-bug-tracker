import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { queryOne } from '../db/database.js';
import { AppError } from './errorHandler.js';
import { AuthenticatedUser, AuthTokenPayload, UserRole } from '../types/index.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded: AuthTokenPayload;

    try {
      decoded = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch (err: any) {
      throw new AppError('Invalid or expired authentication token.', 401);
    }

    // Verify user still exists in database
    const user = await queryOne<{
      id: string;
      email: string;
      name: string;
      role: UserRole;
      organization_id: string | null;
    }>('SELECT id, email, name, role, organization_id FROM users WHERE id = ?', [decoded.userId]);

    if (!user) {
      throw new AppError('User account not found or has been disabled.', 401);
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthorized: Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.user.role}' lacks permission for this action. Allowed roles: ${allowedRoles.join(', ')}`,
          403
        )
      );
    }

    next();
  };
}

export function requireOrgAccess(getOrgId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthorized: Authentication required', 401));
    }

    // Super admin, support manager, and developers can access any organization's resources
    if (['super_admin', 'support_manager', 'developer'].includes(req.user.role)) {
      return next();
    }

    const targetOrgId = getOrgId(req);

    // If client, they must belong to an organization and target must match
    if (req.user.role === 'client') {
      if (!req.user.organizationId || !targetOrgId || req.user.organizationId !== targetOrgId) {
        return next(
          new AppError('Forbidden: Access to another organization’s data is strictly prohibited.', 403)
        );
      }
    }

    next();
  };
}
