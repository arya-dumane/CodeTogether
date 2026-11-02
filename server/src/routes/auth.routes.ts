import { Router } from 'express';
import {
  getCsrfToken,
  getCurrentUser,
  login,
  logout,
  register,
} from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/authRateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

authRouter.get('/csrf', getCsrfToken);
authRouter.post('/register', authRateLimiter, validate(registerSchema), register);
authRouter.post('/login', authRateLimiter, validate(loginSchema), login);
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/logout', logout);
