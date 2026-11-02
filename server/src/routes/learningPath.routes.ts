import { Router } from 'express';
import * as learningPathController from '../controllers/learningPath.controller.js';
import { csrfProtection } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  enrollLearningPathSchema,
  learningPathIdSchema,
  lessonCompletionSchema,
  listLearningPathsSchema,
  myProgressSchema,
} from '../schemas/learningPath.js';

export const learningPathRouter = Router();

learningPathRouter.get('/', validate(listLearningPathsSchema), learningPathController.list);
learningPathRouter.get(
  '/progress',
  requireAuth,
  validate(myProgressSchema),
  learningPathController.listMyProgress,
);
learningPathRouter.get(
  '/:pathId',
  validate(learningPathIdSchema),
  learningPathController.get,
);

learningPathRouter.post(
  '/:pathId/enroll',
  requireAuth,
  csrfProtection,
  validate(enrollLearningPathSchema),
  learningPathController.enroll,
);
learningPathRouter.get(
  '/:pathId/progress',
  requireAuth,
  validate(learningPathIdSchema),
  learningPathController.getProgress,
);
learningPathRouter.put(
  '/:pathId/lessons/:lessonId/complete',
  requireAuth,
  csrfProtection,
  validate(lessonCompletionSchema),
  learningPathController.completeLesson,
);
learningPathRouter.delete(
  '/:pathId/lessons/:lessonId/complete',
  requireAuth,
  csrfProtection,
  validate(lessonCompletionSchema),
  learningPathController.uncompleteLesson,
);
