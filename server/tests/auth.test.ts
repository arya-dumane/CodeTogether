import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import mongoose from 'mongoose';
import request, { type Response } from 'supertest';
import { createApp } from '../src/app.js';
import { closeSessionStore } from '../src/config/session.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { User } from '../src/models/User.js';

const app = createApp();
const PASSWORD = 'correct horse battery staple';
let userCounter = 0;

type TestAgent = ReturnType<typeof request.agent>;

function uniqueEmail(label: string): string {
  userCounter += 1;
  return `${label}-${userCounter}-${Date.now()}@example.com`;
}

function setCookieHeaders(response: { headers: Record<string, unknown> }): string[] {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const header = setCookieHeaders(response).find((value) => value.startsWith('ct.sid='));
  if (!header) {
    throw new Error('Session cookie was not set');
  }
  return header.split(';')[0] ?? header;
}

async function getCsrfToken(agent: TestAgent): Promise<string> {
  const response = await agent.get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  return response.body.data.csrfToken as string;
}

async function registerUser(
  agent: TestAgent,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
) {
  const csrfToken = await getCsrfToken(agent);
  const email = overrides.email ?? uniqueEmail('user');
  const response = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send({
      email,
      password: overrides.password ?? PASSWORD,
      displayName: overrides.displayName ?? 'Ada Lovelace',
    });

  return {
    response,
    email,
    csrfToken: response.body.data?.csrfToken as string | undefined,
  };
}

beforeAll(async () => {
  await connectDatabase();

  if (!mongoose.connection.name.endsWith('_test')) {
    throw new Error('Refusing to run integration tests against a non-test database');
  }

  await User.init();
});

beforeEach(async () => {
  await User.deleteMany({});
  const database = mongoose.connection.db;
  if (database) {
    await database.collection('sessions').deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await closeSessionStore();
  await disconnectDatabase();
});

describe('registration', () => {
  it('creates a user with a hashed password, rotates the session, and sets safe cookie flags', async () => {
    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/v1/auth/csrf');
    const cookieBefore = sessionCookie(csrfResponse);
    const csrfBefore = csrfResponse.body.data.csrfToken as string;
    const email = uniqueEmail('ada');

    const response = await agent
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', csrfBefore)
      .send({ email: email.toUpperCase(), password: PASSWORD, displayName: 'Ada Lovelace' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.displayName).toBe('Ada Lovelace');
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(response.body.data.csrfToken).not.toBe(csrfBefore);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');

    const cookieHeaders = setCookieHeaders(response);
    const cookieHeader = cookieHeaders.join('; ');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).not.toContain('Secure');
    const expiryMatch = cookieHeader.match(/Expires=([^;]+)/);
    expect(expiryMatch).not.toBeNull();
    const daysUntilExpiry = (new Date(expiryMatch?.[1] ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);
    expect(sessionCookie(response)).not.toBe(cookieBefore);

    const storedUser = await User.findOne({ email }).select('+passwordHash');
    expect(storedUser?.passwordHash).not.toBe(PASSWORD);
    expect(storedUser?.passwordHash).toMatch(/^\$2[aby]\$12\$/);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect(me.headers['cache-control']).toBe('no-store');
  });

  it('rejects duplicate accounts with a generic conflict response', async () => {
    const email = uniqueEmail('duplicate');
    await registerUser(request.agent(app), { email });

    const secondAgent = request.agent(app);
    const { response } = await registerUser(secondAgent, { email: email.toUpperCase() });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('REGISTRATION_CONFLICT');
    expect(response.body.error.message).toBe(
      'An account could not be created with those details',
    );
    expect(JSON.stringify(response.body)).not.toContain(email);
  });

  it('rejects invalid registration input with field details', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'not-an-email', password: 'short', displayName: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Request validation failed');

    const paths = (response.body.error.details as Array<{ path: string }>).map(
      (detail) => detail.path,
    );
    expect(paths).toContain('body.email');
    expect(paths).toContain('body.password');
    expect(paths).toContain('body.displayName');
    expect(JSON.stringify(response.body)).not.toContain('stack');

    const unknownFieldToken = await getCsrfToken(agent);
    const unknownField = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', unknownFieldToken)
      .send({
        email: uniqueEmail('unknown'),
        password: PASSWORD,
        displayName: 'Grace Hopper',
        role: 'admin',
      });

    expect(unknownField.status).toBe(400);
    expect(unknownField.body.error.code).toBe('VALIDATION_ERROR');
    expect(await User.countDocuments({})).toBe(0);
  });
});

describe('login and current user', () => {
  it('rejects unknown and incorrect credentials without revealing account details', async () => {
    const email = uniqueEmail('login');
    await registerUser(request.agent(app), { email });

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const wrongPassword = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email, password: 'this is the wrong password' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe('Invalid email or password');
    expect(JSON.stringify(wrongPassword.body)).not.toContain(email);

    const unknownUser = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUser.body.error.message).toBe('Invalid email or password');
    expect(JSON.stringify(unknownUser.body)).not.toContain('nobody@example.com');
  });

  it('logs in, rotates the session identifier and CSRF token, and returns the current user', async () => {
    const email = uniqueEmail('session');
    await registerUser(request.agent(app), { email });

    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/v1/auth/csrf');
    const csrfBefore = csrfResponse.body.data.csrfToken as string;
    const cookieBefore = sessionCookie(csrfResponse);

    const response = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfBefore)
      .send({ email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(response.body.data.csrfToken).not.toBe(csrfBefore);
    expect(sessionCookie(response)).not.toBe(cookieBefore);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);
  });

  it('returns 401 for current-user requests without a session', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Authentication required');
  });

  it('does not accept a forged or expired session cookie', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'ct.sid=forged-session-id');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('logout', () => {
  it('destroys the server-side session, clears the cookie, and rejects the old cookie', async () => {
    const agent = request.agent(app);
    const { response, csrfToken } = await registerUser(agent);
    const oldCookie = sessionCookie(response);

    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', csrfToken as string);

    expect(logout.status).toBe(204);
    const clearedCookie = setCookieHeaders(logout).find((value) => value.startsWith('ct.sid='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970');

    const meAfterLogout = await agent.get('/api/v1/auth/me');
    expect(meAfterLogout.status).toBe(401);

    const replay = await request(app).get('/api/v1/auth/me').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('CSRF protection', () => {
  it('rejects login without a token and with a token from another session', async () => {
    const unauthenticated = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(unauthenticated.status).toBe(403);
    expect(unauthenticated.body.error.code).toBe('CSRF_INVALID');

    const otherAgent = request.agent(app);
    const otherToken = await getCsrfToken(otherAgent);

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    const wrong = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', 'not-the-token')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('CSRF_INVALID');

    const crossSession = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', otherToken)
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(crossSession.status).toBe(403);
    expect(crossSession.body.error.code).toBe('CSRF_INVALID');
    expect(csrfToken).toEqual(expect.any(String));
  });

  it('rejects logout without a matching CSRF token and keeps the session active', async () => {
    const agent = request.agent(app);
    await registerUser(agent);

    const missing = await agent.post('/api/v1/auth/logout');
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_INVALID');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
  });
});

describe('authentication rate limiting', () => {
  it(
    'limits repeated failed authentication attempts and returns a safe error',
    async () => {
      const agent = request.agent(app);
      const csrfToken = await getCsrfToken(agent);
      let limitedResponse: Response | null = null;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const response = await agent
          .post('/api/v1/auth/login')
          .set('x-csrf-token', csrfToken)
          .send({ email: 'not-an-email', password: 'short' });

        if (response.status === 429) {
          limitedResponse = response;
          break;
        }

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }

      expect(limitedResponse).not.toBeNull();
      expect(limitedResponse?.body.error.code).toBe('AUTH_RATE_LIMITED');
      expect(limitedResponse?.body.error.message).toBe(
        'Too many authentication attempts. Try again later.',
      );
      expect(JSON.stringify(limitedResponse?.body)).not.toContain('stack');
    },
    30_000,
  );
});
