import { z } from 'zod';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from '../models/Project.js';

const projectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID');

const projectName = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(
    PROJECT_NAME_MAX_LENGTH,
    `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`,
  );

const projectDescription = z
  .string()
  .trim()
  .max(
    PROJECT_DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`,
  );

const emptyObject = z.object({}).strict();
const projectParams = z.object({ projectId }).strict();

export const listProjectsSchema = z.object({
  body: z.unknown(),
  params: emptyObject,
  query: emptyObject,
});

export const createProjectSchema = z.object({
  body: z
    .object({
      name: projectName,
      description: projectDescription.optional(),
    })
    .strict(),
  params: emptyObject,
  query: emptyObject,
});

export const projectIdSchema = z.object({
  body: z.unknown(),
  params: projectParams,
  query: emptyObject,
});

export const updateProjectSchema = z.object({
  body: z
    .object({
      name: projectName.optional(),
      description: projectDescription.optional(),
    })
    .strict()
    .refine((value) => value.name !== undefined || value.description !== undefined, {
      message: 'Provide at least one field to update',
    }),
  params: projectParams,
  query: emptyObject,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
