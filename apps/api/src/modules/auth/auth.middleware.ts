import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken, type AuthPayload } from './auth.service.js';
import { ROLE_PERMISSIONS, type Permission } from '@costopt/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role as Role | undefined;
    if (!role || !ROLE_PERMISSIONS[role]?.includes(permission)) {
      res.status(403).json({ error: `Forbidden: missing ${permission}` });
      return;
    }
    next();
  };
}
