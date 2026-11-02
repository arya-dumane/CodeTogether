import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { projectRouter } from './project.routes.js';
import { learningPathRouter } from './learningPath.routes.js';
import { roomRouter } from './room.routes.js';
import { sessionMiddleware } from '../config/session.js';
import { csrfProtection } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', sessionMiddleware, csrfProtection, authRouter);
apiRouter.use('/projects', sessionMiddleware, requireAuth, csrfProtection, projectRouter);
apiRouter.use('/learning-paths', sessionMiddleware, learningPathRouter);
apiRouter.use('/rooms', sessionMiddleware, requireAuth, csrfProtection, roomRouter);
