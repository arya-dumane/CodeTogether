import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function issueCsrfToken(req: Request): string {
  const token = generateToken();
  req.session.csrfToken = token;
  return token;
}

export function ensureCsrfToken(req: Request): string {
  return req.session.csrfToken ?? issueCsrfToken(req);
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  const sessionToken = ensureCsrfToken(req);

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const providedToken = req.get(CSRF_HEADER_NAME);

  if (!providedToken || !tokensMatch(providedToken, sessionToken)) {
    next(new AppError(403, 'CSRF_INVALID', 'Invalid or missing CSRF token'));
    return;
  }

  next();
};
