import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns service health without requiring a database connection', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.data.service).toBe('codetogether-api');
    expect(response.body.data.status).toMatch(/^(ok|degraded)$/);
    expect(typeof response.body.data.database.status).toBe('string');
    expect(typeof response.body.data.timestamp).toBe('string');
  });

  it('does not expose environment values', async () => {
    const response = await request(app).get('/api/v1/health');
    const body = JSON.stringify(response.body);

    expect(body).not.toContain('mongodb://');
    expect(body).not.toContain('MONGODB_URI');
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 response', async () => {
    const response = await request(app).get('/api/v1/not-a-real-route');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects an untrusted origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });
});

describe('error handling', () => {
  it('returns a JSON response for malformed request bodies', async () => {
    const response = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});
