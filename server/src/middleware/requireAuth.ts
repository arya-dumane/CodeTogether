import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  next();
};

export function getAuthenticatedUserId(req: Request): string {
  const userId = req.session.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  return userId;
}
