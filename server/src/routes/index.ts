import { Router, type Request, type Response } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { projectRouter } from './project.routes.js';
import { learningPathRouter } from './learningPath.routes.ts';
import { roomRouter } from './room.routes.js';
import { messageRouter } from './message.routes.js';
import { sessionMiddleware } from '../config/session.js';
import { csrfProtection } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/requireAuth.ts';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', sessionMiddleware, csrfProtection, authRouter);
router.use('/projects', sessionMiddleware, requireAuth, csrfProtection, projectRouter);
router.use('/learning-paths', sessionMiddleware, learningPathRouter);
router.use('/rooms', sessionMiddleware, requireAuth, csrfProtection, roomRouter);

export { router as apiRouter };