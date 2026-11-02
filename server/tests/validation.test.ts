import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validate } from '../src/middleware/validate.js';

const schema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
  }),
  params: z.object({}),
  query: z.object({}),
});

const app = express();
app.use(express.json());
app.post('/echo', validate(schema), (req, res) => {
  res.json({ data: req.body });
});
app.use(errorHandler);

describe('validate middleware', () => {
  it('accepts and replaces the body with validated data', async () => {
    const response = await request(app).post('/echo').send({ name: 'Ada', ignored: true });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ name: 'Ada' });
  });

  it('returns structured validation details for invalid input', async () => {
    const response = await request(app).post('/echo').send({ name: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([
      { path: 'body.name', message: 'Name must be at least 2 characters' },
    ]);
  });
});
