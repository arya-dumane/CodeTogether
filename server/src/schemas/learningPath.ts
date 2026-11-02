import { z } from 'zod';

const objectId = (label: string) =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label} ID`);

const pathParams = z.object({ pathId: objectId('learning path') }).strict();
const lessonParams = z
  .object({
    pathId: objectId('learning path'),
    lessonId: objectId('lesson'),
  })
  .strict();

const emptyObject = z.object({}).strict();
const emptyBody = z.object({}).strict().optional();

export const listLearningPathsSchema = z.object({
  body: z.unknown(),
  params: emptyObject,
  query: emptyObject,
});

export const learningPathIdSchema = z.object({
  body: z.unknown(),
  params: pathParams,
  query: emptyObject,
});

export const enrollLearningPathSchema = z.object({
  body: emptyBody,
  params: pathParams,
  query: emptyObject,
});

export const lessonCompletionSchema = z.object({
  body: emptyBody,
  params: lessonParams,
  query: emptyObject,
});

export const myProgressSchema = z.object({
  body: z.unknown(),
  params: emptyObject,
  query: emptyObject,
});
