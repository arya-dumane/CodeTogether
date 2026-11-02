---
name: express-api-architecture
description: Build maintainable Express APIs in TypeScript and Node.js. Use when designing routes, controllers, services, middleware, request validation, centralized error handling, authentication, authorization, or API tests for the CodeTogether backend.
---

# Express API Architecture

## Goals
Build a typed, layered Express API that is easy to test and secure by default. Keep HTTP concerns in routes and controllers, business rules in services, and persistence in models or repositories.

## Project structure

```
server/
├── src/
│   ├── app.ts                  # Express app factory (no listen)
│   ├── server.ts               # Process entry point; starts HTTP and Socket.IO
│   ├── config/                 # Environment parsing and startup validation
│   ├── routes/                 # Router definitions per feature
│   ├── controllers/            # Request/response translation
│   ├── services/               # Business logic
│   ├── models/                 # Mongoose schemas and repositories
│   ├── middleware/             # Auth, validation, errors, rate limits
│   ├── schemas/                # Request validation schemas
│   ├── errors/                 # Typed application errors
│   └── types/                  # Shared TypeScript types
└── tests/
    ├── integration/            # Supertest against the app
    └── unit/                   # Service tests
```

Export an app factory (`createApp()`) from `app.ts` and call `listen()` only in `server.ts`. This keeps integration tests fast and avoids binding a port during tests.

## Routing
- Group routes by resource and mount them under a versioned prefix such as `/api/v1`.
- Keep routers declarative: method, path, middleware chain, controller. No business logic in route files.
- Use `express.Router({ mergeParams: true })` for nested resources.
- Define route parameter names explicitly and validate them like any other input.
- Return consistent resource-oriented paths and status codes:

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProjectSchema, projectIdSchema } from '../schemas/projects';
import * as projects from '../controllers/projects';

const router = Router();

router.get('/', requireAuth, projects.list);
router.post('/', requireAuth, validate(createProjectSchema), projects.create);
router.get('/:projectId', requireAuth, validate(projectIdSchema), projects.get);
router.patch('/:projectId', requireAuth, validate(projectIdSchema), projects.update);
router.delete('/:projectId', requireAuth, validate(projectIdSchema), projects.remove);

export default router;
```

## Controllers
- Controllers translate HTTP to service calls and service results to responses.
- Read the authenticated user from `req.user`, never from the body.
- Do not query the database directly from a controller; call a service.
- Keep controllers thin and free of reusable business rules.
- Forward errors with `next(error)` rather than sending ad-hoc error responses.

```typescript
import type { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/projects';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.createProject(req.user!.id, req.body);
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
}
```

## Services
- Services own business rules, authorization decisions that depend on loaded data, and transaction boundaries.
- Accept primitives and typed inputs, not Express `Request` objects.
- Throw typed application errors (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`) instead of HTTP-specific responses.
- Keep services independent of Express so they can be unit-tested and reused by Socket.IO handlers.
- Load the resource, check ownership or membership, then mutate.

```typescript
import { ForbiddenError, NotFoundError } from '../errors';

export async function getProject(userId: string, projectId: string) {
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw new NotFoundError('Project not found');
  if (!project.members.some((member) => member.toString() === userId)) {
    throw new ForbiddenError('Not a project member');
  }
  return project;
}
```

## Middleware
- Compose small, single-purpose middleware: `requireAuth`, `requireProjectMember`, `validate`, `rateLimit`, `errorHandler`.
- Attach typed user/session data to the request with a module augmentation or a typed `Request` generic.
- Make middleware async-safe: either use an `asyncHandler` wrapper or Express 5 native promise handling; never leave rejected promises unhandled.
- Register JSON body parsing with an explicit size limit.
- Register security headers and CORS before routes.

```typescript
export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

## Request validation
- Validate `body`, `params`, and `query` with a schema library such as Zod.
- Replace the request section with the parsed, typed value so controllers never consume raw input.
- Reject unknown keys and enforce explicit bounds.
- Return `400` with field-level details, but do not echo the entire request body.

```typescript
import { z } from 'zod';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    language: z.enum(['typescript', 'javascript', 'python']),
  }).strict(),
  params: z.object({}),
  query: z.object({}),
});

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) return next(result.error);
    Object.assign(req, result.data);
    next();
  };
}
```

## Authentication
- Authenticate with a server-verified session or token on every protected request.
- Hash passwords with bcrypt, scrypt, or Argon2; never store plaintext.
- Set session cookies with `HttpOnly`, `Secure` in production, and an appropriate `SameSite` value.
- Invalidate server-side session state on logout and rotate the session after login.
- Return `401` for missing or invalid credentials and avoid revealing whether an account exists.

## Authorization
- Authenticate first, then authorize per resource.
- Check project ownership or membership on the server for every read and write.
- Prefer a reusable guard such as `requireProjectMember('projectId')` over repeating checks in each controller.
- Default to deny: an unrecognized role or missing membership is a rejection.
- Reuse the same authorization functions from Socket.IO handlers so REST and real-time paths cannot drift.

## Centralized error handling
- Define a base `AppError` with `statusCode`, a stable machine-readable `code`, and a safe message.
- Install one error-handling middleware last; it maps known errors to responses and unknown errors to a generic `500`.
- Log unknown errors with a request ID; never send stack traces or database errors to clients.
- Handle Zod validation errors, JSON parse errors, and Mongoose validation or duplicate-key errors explicitly.
- Ensure responses have a consistent shape: `{ error: { code, message, details? } }`.

```typescript
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues },
    });
  }
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
```

## Configuration and startup
- Parse environment variables once at startup and fail fast when required values are missing.
- Never fall back to production defaults for secrets or database URIs.
- Keep `app.ts` free of side effects; start Socket.IO and the HTTP server only in `server.ts`.
- Handle `SIGTERM`/`SIGINT` by closing the HTTP server, Socket.IO, and database connections.

## Testing
- Use Supertest against `createApp()` for integration tests; do not bind a real port unless required.
- Use an isolated test database and reset state between tests.
- Test happy paths plus `400`, `401`, `403`, `404`, and `409` cases.
- Mock external services, not the layer under test.
- Unit-test services with typed inputs and fake repositories.
- Verify that unauthorized users cannot read or mutate another user's project.

```typescript
import request from 'supertest';
import { createApp } from '../src/app';

describe('POST /api/v1/projects', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await request(createApp()).post('/api/v1/projects').send({ name: 'x' });
    expect(response.status).toBe(401);
  });

  it('rejects invalid bodies', async () => {
    const response = await request(createApp())
      .post('/api/v1/projects')
      .set('Cookie', authCookie)
      .send({ name: '' });
    expect(response.status).toBe(400);
  });
});
```

## Checklist
- [ ] Routes contain no business logic or database access.
- [ ] Controllers are thin and forward errors with `next`.
- [ ] Services are Express-independent and throw typed errors.
- [ ] Every body, param, and query is validated against a schema.
- [ ] One centralized error handler returns consistent, safe responses.
- [ ] Authentication is required on protected routes and authorization checks ownership or membership.
- [ ] REST and Socket.IO share the same authorization logic.
- [ ] Integration tests cover success, validation failure, unauthenticated, and forbidden cases.
- [ ] The app factory can be imported without starting a server.
