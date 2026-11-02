import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must be at least 2 characters')
  .max(50, 'Display name must be at most 50 characters');

export const registerSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: passwordSchema,
      displayName: displayNameSchema,
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: z.string().min(1, 'Enter your password').max(128),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
