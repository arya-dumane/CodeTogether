import type { Request } from 'express';
import { issueCsrfToken } from '../middleware/csrf.js';

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function startAuthenticatedSession(req: Request, userId: string): Promise<string> {
  await regenerateSession(req);
  req.session.userId = userId;
  const csrfToken = issueCsrfToken(req);
  await saveSession(req);
  return csrfToken;
}

export async function endAuthenticatedSession(req: Request): Promise<void> {
  await destroySession(req);
}
