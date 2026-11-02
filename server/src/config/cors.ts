import type { CorsOptions } from 'cors';
import { AppError } from '../errors/AppError.js';
import { env } from './env.js';

export const allowedOrigins = new Set(env.corsOrigins);

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.has(origin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
