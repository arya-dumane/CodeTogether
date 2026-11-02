import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeSessionStore } from '../src/config/session.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';

const app = createApp();
const PASSWORD = 'correct horse battery staple';
let userCounter = 0;

type TestAgent = ReturnType<typeof request.agent>;

interface TestSession {
  agent: TestAgent;
  user: { id: string; email: string; displayName: string };
  csrfToken: string;
}

function uniqueEmail(label: string): string {
  userCounter += 1;
  return `${label}-${userCounter}-${Date.now()}@example.com`;
}

async function register(label: string): Promise<TestSession> {
  const agent = request.agent(app);
  const csrfResponse = await agent.get('/api/v1/auth/csrf');

  const email = uniqueEmail(label);
  const response = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfResponse.body.data.csrfToken as string)
    .send({ email, password: PASSWORD, displayName: 'Project Tester' });

  expect(response.status).toBe(201);

  return {
    agent,
    user: response.body.data.user as TestSession['user'],
    csrfToken: response.body.data.csrfToken as string,
  };
}

function createProject(session: TestSession, body: Record<string, unknown>) {
  return session.agent
    .post('/api/v1/projects')
    .set('x-csrf-token', session.csrfToken)
    .send(body);
}

function updateProject(
  session: TestSession,
  projectId: string,
  body: Record<string, unknown>,
) {
  return session.agent
    .patch(`/api/v1/projects/${projectId}`)
    .set('x-csrf-token', session.csrfToken)
    .send(body);
}

function deleteProject(session: TestSession, projectId: string) {
  return session.agent
    .delete(`/api/v1/projects/${projectId}`)
    .set('x-csrf-token', session.csrfToken);
}

async function createProjectSuccessfully(
  session: TestSession,
  overrides: Record<string, unknown> = {},
) {
  const response = await createProject(session, {
    name: 'Shared Project',
    description: 'A project used in tests',
    ...overrides,
  });

  expect(response.status).toBe(201);
  return response.body.data.project as { id: string; name: string };
}

beforeAll(async () => {
  await connectDatabase();

  if (!mongoose.connection.name.endsWith('_test')) {
    throw new Error('Refusing to run integration tests against a non-test database');
  }

  await User.init();
  await Project.init();
});

beforeEach(async () => {
  await Project.deleteMany({});
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

describe('POST /api/v1/projects', () => {
  it('creates a project owned by the authenticated user and trims fields', async () => {
    const session = await register('create');

    const response = await createProject(session, {
      name: '  First Project  ',
      description: '  Built in Phase 2B  ',
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');

    const project = response.body.data.project as Record<string, unknown>;
    expect(project.id).toEqual(expect.any(String));
    expect(project.name).toBe('First Project');
    expect(project.description).toBe('Built in Phase 2B');
    expect(project.ownerId).toBe(session.user.id);
    expect(project.createdAt).toEqual(expect.any(String));
    expect(project.updatedAt).toEqual(expect.any(String));
    expect(project).not.toHaveProperty('owner');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const stored = await Project.findById(project.id as string);
    expect(stored).not.toBeNull();
    expect(stored?.owner.toString()).toBe(session.user.id);
  });

  it('defaults a missing description to an empty string', async () => {
    const session = await register('create-no-description');
    const response = await createProject(session, { name: 'No description' });

    expect(response.status).toBe(201);
    expect(response.body.data.project.description).toBe('');
  });

  it('rejects missing, blank, and over-long fields', async () => {
    const session = await register('create-validation');

    const missingName = await createProject(session, { description: 'No name here' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');
    const missingNamePaths = (missingName.body.error.details as Array<{ path: string }>).map(
      (detail) => detail.path,
    );
    expect(missingNamePaths).toContain('body.name');

    const blankName = await createProject(session, { name: '   ' });
    expect(blankName.status).toBe(400);

    const longName = await createProject(session, { name: 'a'.repeat(121) });
    expect(longName.status).toBe(400);

    const longDescription = await createProject(session, {
      name: 'Valid name',
      description: 'a'.repeat(2001),
    });
    expect(longDescription.status).toBe(400);

    const wrongType = await createProject(session, { name: 42 });
    expect(wrongType.status).toBe(400);

    expect(await Project.countDocuments({})).toBe(0);
    expect(JSON.stringify(missingName.body)).not.toContain('stack');
  });

  it('rejects unknown and protected fields, including an owner reassignment attempt', async () => {
    const session = await register('create-unknown-fields');
    const other = await register('create-unknown-fields-other');

    const attempts = [
      { name: 'Owner attempt', owner: other.user.id },
      { name: 'Owner attempt', ownerId: other.user.id },
      { name: 'Status attempt', status: 'archived' },
      { name: 'Id attempt', _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'Timestamp attempt', createdAt: new Date().toISOString() },
    ];

    for (const body of attempts) {
      const response = await createProject(session, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    expect(await Project.countDocuments({})).toBe(0);
  });

  it('requires authentication and CSRF protection', async () => {
    const unauthenticated = await request(app)
      .post('/api/v1/projects')
      .send({ name: 'No session' });

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const session = await register('create-csrf');
    const other = await register('create-csrf-other');

    const missingToken = await session.agent
      .post('/api/v1/projects')
      .send({ name: 'No CSRF token' });
    expect(missingToken.status).toBe(403);
    expect(missingToken.body.error.code).toBe('CSRF_INVALID');

    const wrongToken = await session.agent
      .post('/api/v1/projects')
      .set('x-csrf-token', 'not-the-token')
      .send({ name: 'Wrong CSRF token' });
    expect(wrongToken.status).toBe(403);
    expect(wrongToken.body.error.code).toBe('CSRF_INVALID');

    const foreignToken = await session.agent
      .post('/api/v1/projects')
      .set('x-csrf-token', other.csrfToken)
      .send({ name: 'Foreign CSRF token' });
    expect(foreignToken.status).toBe(403);
    expect(foreignToken.body.error.code).toBe('CSRF_INVALID');

    expect(await Project.countDocuments({})).toBe(0);
  });
});

describe('GET /api/v1/projects', () => {
  it('lists only the authenticated user projects', async () => {
    const first = await register('list-first');
    const second = await register('list-second');

    await createProjectSuccessfully(first, { name: 'First A' });
    await createProjectSuccessfully(first, { name: 'First B' });
    await createProjectSuccessfully(second, { name: 'Second A' });

    const response = await first.agent.get('/api/v1/projects');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const projects = response.body.data.projects as Array<{ name: string; ownerId: string }>;
    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.name).sort()).toEqual(['First A', 'First B']);
    expect(projects.every((project) => project.ownerId === first.user.id)).toBe(true);
    expect(projects.some((project) => project.name === 'Second A')).toBe(false);
  });

  it('returns an empty list for a user without projects', async () => {
    const session = await register('list-empty');
    const response = await session.agent.get('/api/v1/projects');

    expect(response.status).toBe(200);
    expect(response.body.data.projects).toEqual([]);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/projects');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/v1/projects/:projectId', () => {
  it('returns an owned project', async () => {
    const session = await register('get-owned');
    const created = await createProjectSuccessfully(session, { name: 'Owned detail' });

    const response = await session.agent.get(`/api/v1/projects/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.project.id).toBe(created.id);
    expect(response.body.data.project.name).toBe('Owned detail');
    expect(response.body.data.project.ownerId).toBe(session.user.id);
  });

  it('rejects malformed identifiers and unknown projects safely', async () => {
    const session = await register('get-invalid');

    const malformed = await session.agent.get('/api/v1/projects/not-an-object-id');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await session.agent.get(
      '/api/v1/projects/aaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    expect(unknown.body.error.message).toBe('Project not found');
  });

  it('requires authentication', async () => {
    const response = await request(app).get(
      '/api/v1/projects/aaaaaaaaaaaaaaaaaaaaaaaa',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('PATCH /api/v1/projects/:projectId', () => {
  it('updates allowed fields for an owned project', async () => {
    const session = await register('update-owned');
    const created = await createProjectSuccessfully(session);

    const response = await updateProject(session, created.id, {
      name: '  Renamed project  ',
      description: '  Updated description  ',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.project.name).toBe('Renamed project');
    expect(response.body.data.project.description).toBe('Updated description');

    const refetched = await session.agent.get(`/api/v1/projects/${created.id}`);
    expect(refetched.body.data.project.name).toBe('Renamed project');
    expect(refetched.body.data.project.description).toBe('Updated description');
  });

  it('supports updating only the description and clearing it', async () => {
    const session = await register('update-description');
    const created = await createProjectSuccessfully(session, { name: 'Keep name' });

    const response = await updateProject(session, created.id, { description: '' });

    expect(response.status).toBe(200);
    expect(response.body.data.project.name).toBe('Keep name');
    expect(response.body.data.project.description).toBe('');
  });

  it('rejects empty patches, unknown fields, and owner reassignment', async () => {
    const session = await register('update-protected');
    const other = await register('update-protected-other');
    const created = await createProjectSuccessfully(session, { name: 'Original name' });

    const empty = await updateProject(session, created.id, {});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const attempts = [
      { owner: other.user.id },
      { ownerId: other.user.id },
      { name: 'Hijacked', owner: other.user.id },
      { status: 'archived' },
      { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
      { createdAt: new Date().toISOString() },
      { name: '' },
      { name: 'a'.repeat(121) },
      { description: 'a'.repeat(2001) },
    ];

    for (const body of attempts) {
      const response = await updateProject(session, created.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const stored = await Project.findById(created.id);
    expect(stored?.name).toBe('Original name');
    expect(stored?.owner.toString()).toBe(session.user.id);
  });

  it('rejects malformed identifiers and requires authentication and CSRF protection', async () => {
    const session = await register('update-guards');
    const created = await createProjectSuccessfully(session);

    const malformed = await updateProject(session, 'bad-id', { name: 'Nope' });
    expect(malformed.status).toBe(400);

    const unauthenticated = await request(app)
      .patch(`/api/v1/projects/${created.id}`)
      .send({ name: 'No session' });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const missingCsrf = await session.agent
      .patch(`/api/v1/projects/${created.id}`)
      .send({ name: 'No CSRF token' });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID');
  });
});

describe('DELETE /api/v1/projects/:projectId', () => {
  it('deletes an owned project', async () => {
    const session = await register('delete-owned');
    const created = await createProjectSuccessfully(session);

    const response = await deleteProject(session, created.id);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await Project.countDocuments({ _id: created.id })).toBe(0);

    const refetched = await session.agent.get(`/api/v1/projects/${created.id}`);
    expect(refetched.status).toBe(404);
  });

  it('rejects malformed identifiers and requires authentication and CSRF protection', async () => {
    const session = await register('delete-guards');
    const created = await createProjectSuccessfully(session);

    const malformed = await deleteProject(session, 'bad-id');
    expect(malformed.status).toBe(400);

    const unauthenticated = await request(app).delete(
      `/api/v1/projects/${created.id}`,
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const missingCsrf = await session.agent.delete(
      `/api/v1/projects/${created.id}`,
    );
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID');

    expect(await Project.countDocuments({ _id: created.id })).toBe(1);
  });
});

describe('cross-account isolation', () => {
  it('does not disclose or allow changes to another user project', async () => {
    const owner = await register('owner');
    const intruder = await register('intruder');
    const created = await createProjectSuccessfully(owner, { name: 'Owner secret' });

    const read = await intruder.agent.get(`/api/v1/projects/${created.id}`);
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe('NOT_FOUND');
    expect(read.body.error.message).toBe('Project not found');

    const update = await updateProject(intruder, created.id, { name: 'Hijacked' });
    expect(update.status).toBe(404);
    expect(update.body.error.code).toBe('NOT_FOUND');

    const remove = await deleteProject(intruder, created.id);
    expect(remove.status).toBe(404);
    expect(remove.body.error.code).toBe('NOT_FOUND');

    const list = await intruder.agent.get('/api/v1/projects');
    expect(list.body.data.projects).toEqual([]);

    const stored = await Project.findById(created.id);
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Owner secret');
    expect(stored?.owner.toString()).toBe(owner.user.id);

    const ownerRead = await owner.agent.get(`/api/v1/projects/${created.id}`);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.data.project.name).toBe('Owner secret');
  });
});
