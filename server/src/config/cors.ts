import type { CorsOptions } from 'cors';
import { AppError } from '../errors/AppError.js';
import { env } from './env.js';

export const allowedOrigins = new Set(env.corsOrigins);

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.has(origin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    console.log('[cors] Request origin:', origin);
    console.log('[cors] Allowed origins:', [...allowedOrigins]);
    if (isAllowedOrigin(origin)) {
      console.log('[cors] Origin accepted');
      callback(null, true);
      return;
    }

    console.log('[cors] Origin rejected');
    callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
