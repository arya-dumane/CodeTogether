import 'dotenv/config';
import { z } from 'zod';

const DEVELOPMENT_SESSION_SECRET = 'dev-only-session-secret-change-before-production';
const EXAMPLE_SESSION_SECRET = 'replace-this-with-a-unique-session-secret-of-at-least-32-chars';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/codetogether'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SESSION_SECRET),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  [DEVELOPMENT_SESSION_SECRET, EXAMPLE_SESSION_SECRET].includes(parsed.data.SESSION_SECRET)
) {
  console.error('SESSION_SECRET must be set to a unique value in production');
  process.exit(1);
}

if (parsed.data.COOKIE_SAME_SITE === 'none' && parsed.data.NODE_ENV !== 'production') {
  console.error('COOKIE_SAME_SITE=none requires Secure cookies and is only allowed in production');
  process.exit(1);
}

const corsOrigins = parsed.data.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter((origin) => origin.length > 0);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  port: parsed.data.PORT,
  mongoUri: parsed.data.MONGODB_URI,
  corsOrigins,
  sessionSecret: parsed.data.SESSION_SECRET,
  cookieSameSite: parsed.data.COOKIE_SAME_SITE,
  cookieSecure: parsed.data.NODE_ENV === 'production',
  trustProxy: parsed.data.TRUST_PROXY,
};
