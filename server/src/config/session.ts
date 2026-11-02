import session from 'express-session';
import MongoStore from 'connect-mongo';
import type { CookieOptions, Response } from 'express';
import { env } from './env.js';

export const SESSION_COOKIE_NAME = 'ct.sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sessionStore = MongoStore.create({
  mongoUrl: env.mongoUri,
  collectionName: 'sessions',
  ttl: Math.floor(SESSION_TTL_MS / 1000),
  autoRemove: 'native',
});

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/',
  maxAge: SESSION_TTL_MS,
};

export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: env.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: sessionCookieOptions,
});

export function clearSessionCookie(res: Response): void {
  const options = { ...sessionCookieOptions };
  delete options.maxAge;
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

export async function closeSessionStore(): Promise<void> {
  await sessionStore.close();
}
