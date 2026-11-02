import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export interface ValidatedRequest {
  body: unknown;
  params: unknown;
  query: unknown;
}

export function validate(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      next(result.error);
      return;
    }

    const validated = result.data as ValidatedRequest;
    res.locals.validated = validated;

    if (validated.body !== undefined) {
      req.body = validated.body;
    }

    next();
  };
}
