import type { RequestHandler } from 'express';
import { clearSessionCookie } from '../config/session.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { getAuthenticatedUserId } from '../middleware/requireAuth.js';
import { serializeUser } from '../models/User.js';
import { disconnectSessionPresence } from '../realtime/index.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';
import { authenticateUser, findUserById, registerUser } from '../services/auth.service.js';
import {
  endAuthenticatedSession,
  startAuthenticatedSession,
} from '../services/session.service.js';

export const getCsrfToken: RequestHandler = (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  res.status(200).json({ data: { csrfToken } });
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { body } = res.locals.validated as { body: RegisterInput };
    const user = await registerUser(body);
    const csrfToken = await startAuthenticatedSession(req, user._id.toString());

    res.status(201).json({
      data: {
        user: serializeUser(user),
        csrfToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { body } = res.locals.validated as { body: LoginInput };
    const user = await authenticateUser(body);
    const csrfToken = await startAuthenticatedSession(req, user._id.toString());

    res.status(200).json({
      data: {
        user: serializeUser(user),
        csrfToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const user = await findUserById(userId);
    res.status(200).json({ data: { user: serializeUser(user) } });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const sessionId = req.sessionID;
    await endAuthenticatedSession(req);
    clearSessionCookie(res);
    disconnectSessionPresence(sessionId, 'SESSION_ENDED');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
