import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { AppError } from '../lib/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';

export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' }));
    return;
  }

  try {
    const token = header.slice('Bearer '.length);
    const payload: AccessTokenPayload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
      phone: payload.phone,
    };
    next();
  } catch {
    next(new AppError('Invalid or expired access token', { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' }));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', { statusCode: 403, code: 'FORBIDDEN' }));
      return;
    }
    next();
  };
}
