import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdSchema,
  updateProjectSchema,
} from '../schemas/project.js';

export const projectRouter = Router();

projectRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

projectRouter.get('/', validate(listProjectsSchema), projectController.list);
projectRouter.post('/', validate(createProjectSchema), projectController.create);
projectRouter.get('/:projectId', validate(projectIdSchema), projectController.get);
projectRouter.patch('/:projectId', validate(updateProjectSchema), projectController.update);
projectRouter.delete('/:projectId', validate(projectIdSchema), projectController.remove);
