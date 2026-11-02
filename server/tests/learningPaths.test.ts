import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeSessionStore } from '../src/config/session.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { LearningPath } from '../src/models/LearningPath.js';
import { LearningProgress } from '../src/models/LearningProgress.js';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';

const app = createApp();
const PASSWORD = 'correct horse battery staple';
let pathCounter = 0;
let userCounter = 0;

type TestAgent = ReturnType<typeof request.agent>;

interface TestSession {
  agent: TestAgent;
  user: { id: string; email: string; displayName: string };
  csrfToken: string;
}

interface LessonSpec {
  title: string;
  position?: number;
  type?: 'reading' | 'exercise';
}

interface ModuleSpec {
  title: string;
  position?: number;
  lessons: LessonSpec[];
}

interface CreatedPath {
  id: string;
  modules: Array<{ id: string; lessons: Array<{ id: string; title: string }> }>;
  lessons: Array<{ id: string; title: string }>;
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
    .send({ email, password: PASSWORD, displayName: 'Learning Tester' });

  expect(response.status).toBe(201);

  return {
    agent,
    user: response.body.data.user as TestSession['user'],
    csrfToken: response.body.data.csrfToken as string,
  };
}

async function createPath(
  spec: { modules?: ModuleSpec[]; status?: 'draft' | 'published'; title?: string },
): Promise<CreatedPath> {
  pathCounter += 1;
  const title = spec.title ?? `Test Path ${pathCounter}`;
  const moduleSpecs = spec.modules ?? [
    { title: 'Module A', lessons: [{ title: 'Lesson A1' }, { title: 'Lesson A2' }] },
    { title: 'Module B', lessons: [{ title: 'Lesson B1' }, { title: 'Lesson B2' }] },
  ];

  const modules = moduleSpecs.map((module, moduleIndex) => ({
    _id: new Types.ObjectId(),
    title: module.title,
    description: `${module.title} description`,
    position: module.position ?? moduleIndex,
    lessons: module.lessons.map((lesson, lessonIndex) => ({
      _id: new Types.ObjectId(),
      title: lesson.title,
      shortDescription: `${lesson.title} summary`,
      content: `${lesson.title} content`,
      estimatedDurationMinutes: 10,
      type: lesson.type ?? ('reading' as const),
      position: lesson.position ?? lessonIndex,
    })),
  }));

  const path = await LearningPath.create({
    title,
    slug: `test-path-${pathCounter}-${Date.now()}`,
    shortDescription: `${title} summary`,
    detailedDescription: `${title} detailed description`,
    difficulty: 'beginner',
    category: 'Web Development',
    estimatedDurationMinutes: 120,
    modules,
    status: spec.status ?? 'published',
  });

  return {
    id: path._id.toString(),
    modules: modules.map((module) => ({
      id: module._id.toString(),
      lessons: module.lessons.map((lesson) => ({
        id: lesson._id.toString(),
        title: lesson.title,
      })),
    })),
    lessons: modules.flatMap((module) =>
      module.lessons.map((lesson) => ({ id: lesson._id.toString(), title: lesson.title })),
    ),
  };
}

function enroll(session: TestSession, pathId: string, includeCsrf = true) {
  const agent = session.agent.post(`/api/v1/learning-paths/${pathId}/enroll`);
  return includeCsrf ? agent.set('x-csrf-token', session.csrfToken) : agent;
}

function completeLesson(session: TestSession, pathId: string, lessonId: string) {
  return session.agent
    .put(`/api/v1/learning-paths/${pathId}/lessons/${lessonId}/complete`)
    .set('x-csrf-token', session.csrfToken);
}

function uncompleteLesson(session: TestSession, pathId: string, lessonId: string) {
  return session.agent
    .delete(`/api/v1/learning-paths/${pathId}/lessons/${lessonId}/complete`)
    .set('x-csrf-token', session.csrfToken);
}

function progressOf(response: request.Response): Record<string, unknown> {
  return response.body.data.progress as Record<string, unknown>;
}

beforeAll(async () => {
  await connectDatabase();

  if (!mongoose.connection.name.endsWith('_test')) {
    throw new Error('Refusing to run integration tests against a non-test database');
  }

  await User.init();
  await Project.init();
  await LearningPath.init();
  await LearningProgress.init();
});

beforeEach(async () => {
  await LearningProgress.deleteMany({});
  await LearningPath.deleteMany({});
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

describe('GET /api/v1/learning-paths', () => {
  it('lists only published learning paths without lesson content', async () => {
    await createPath({ title: 'Beta Path' });
    await createPath({ title: 'Alpha Path' });
    await createPath({ title: 'Draft Path', status: 'draft' });

    const response = await request(app).get('/api/v1/learning-paths');

    expect(response.status).toBe(200);
    const paths = response.body.data.paths as Array<Record<string, unknown>>;
    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.title)).toEqual(['Alpha Path', 'Beta Path']);
    expect(paths[0]).toMatchObject({
      difficulty: 'beginner',
      category: 'Web Development',
      moduleCount: 2,
      lessonCount: 4,
    });
    expect(paths[0]).not.toHaveProperty('modules');
    expect(JSON.stringify(response.body)).not.toContain('content');
  });
});

describe('GET /api/v1/learning-paths/:pathId', () => {
  it('returns published path details with modules and lessons in position order', async () => {
    const created = await createPath({
      modules: [
        {
          title: 'Second module',
          position: 1,
          lessons: [
            { title: 'Second lesson', position: 1 },
            { title: 'First lesson', position: 0 },
          ],
        },
        {
          title: 'First module',
          position: 0,
          lessons: [{ title: 'Only lesson', position: 0 }],
        },
      ],
    });

    const response = await request(app).get(`/api/v1/learning-paths/${created.id}`);

    expect(response.status).toBe(200);
    const path = response.body.data.path as {
      modules: Array<{ title: string; lessons: Array<{ title: string; content: string }> }>;
    };

    expect(path.modules.map((module) => module.title)).toEqual([
      'First module',
      'Second module',
    ]);
    expect(path.modules[1]?.lessons.map((lesson) => lesson.title)).toEqual([
      'First lesson',
      'Second lesson',
    ]);
    expect(path.modules[0]?.lessons[0]?.content).toBe('Only lesson content');
  });

  it('rejects malformed identifiers and unknown paths', async () => {
    const malformed = await request(app).get('/api/v1/learning-paths/not-an-id');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(app).get(
      '/api/v1/learning-paths/aaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    expect(unknown.body.error.message).toBe('Learning path not found');
  });

  it('does not expose unpublished paths through direct URLs', async () => {
    const draft = await createPath({ status: 'draft' });

    const detail = await request(app).get(`/api/v1/learning-paths/${draft.id}`);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('NOT_FOUND');

    const session = await register('draft-enroll');
    const enrollment = await enroll(session, draft.id);
    expect(enrollment.status).toBe(404);
    expect(enrollment.body.error.code).toBe('NOT_FOUND');

    const progress = await session.agent.get(
      `/api/v1/learning-paths/${draft.id}/progress`,
    );
    expect(progress.status).toBe(404);
  });
});

describe('progress authentication and CSRF', () => {
  it('requires authentication for all progress operations', async () => {
    const path = await createPath({});
    const lessonId = path.lessons[0]?.id as string;

    const requests = [
      request(app).post(`/api/v1/learning-paths/${path.id}/enroll`),
      request(app).get(`/api/v1/learning-paths/${path.id}/progress`),
      request(app).get('/api/v1/learning-paths/progress'),
      request(app).put(`/api/v1/learning-paths/${path.id}/lessons/${lessonId}/complete`),
      request(app).delete(`/api/v1/learning-paths/${path.id}/lessons/${lessonId}/complete`),
    ];

    for (const pending of requests) {
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('requires CSRF tokens on enrollment and completion', async () => {
    const session = await register('progress-csrf');
    const path = await createPath({});
    const lessonId = path.lessons[0]?.id as string;

    const missingEnrollCsrf = await enroll(session, path.id, false);
    expect(missingEnrollCsrf.status).toBe(403);
    expect(missingEnrollCsrf.body.error.code).toBe('CSRF_INVALID');

    const enrollment = await enroll(session, path.id);
    expect(enrollment.status).toBe(201);

    const missingCompleteCsrf = await session.agent.put(
      `/api/v1/learning-paths/${path.id}/lessons/${lessonId}/complete`,
    );
    expect(missingCompleteCsrf.status).toBe(403);
    expect(missingCompleteCsrf.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects client-supplied user identifiers in the enrollment body', async () => {
    const session = await register('progress-body');
    const other = await register('progress-body-other');
    const path = await createPath({});

    const response = await session.agent
      .post(`/api/v1/learning-paths/${path.id}/enroll`)
      .set('x-csrf-token', session.csrfToken)
      .send({ userId: other.user.id });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await LearningProgress.countDocuments({})).toBe(0);
  });
});

describe('enrollment', () => {
  it('enrolls idempotently and returns a zero-progress view', async () => {
    const session = await register('enroll');
    const path = await createPath({});

    const before = await session.agent.get(
      `/api/v1/learning-paths/${path.id}/progress`,
    );
    expect(before.status).toBe(200);
    expect(before.headers['cache-control']).toBe('no-store');
    expect(progressOf(before)).toMatchObject({
      pathId: path.id,
      enrolled: false,
      completedCount: 0,
      totalLessons: 4,
      percentage: 0,
      enrolledAt: null,
      lastActivityAt: null,
      completedAt: null,
    });

    const first = await enroll(session, path.id);
    expect(first.status).toBe(201);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(progressOf(first)).toMatchObject({
      pathId: path.id,
      enrolled: true,
      completedCount: 0,
      totalLessons: 4,
      percentage: 0,
    });
    expect(progressOf(first).enrolledAt).toEqual(expect.any(String));

    const repeated = await enroll(session, path.id);
    expect(repeated.status).toBe(200);
    expect(progressOf(repeated)).toMatchObject({ enrolled: true, percentage: 0 });
    expect(await LearningProgress.countDocuments({})).toBe(1);
  });

  it('returns an enrolled progress record only for the authenticated user', async () => {
    const first = await register('enroll-isolation-a');
    const second = await register('enroll-isolation-b');
    const path = await createPath({});

    await enroll(first, path.id);

    const firstList = await first.agent.get('/api/v1/learning-paths/progress');
    expect(firstList.status).toBe(200);
    expect(firstList.headers['cache-control']).toBe('no-store');
    expect(firstList.body.data.enrollments).toHaveLength(1);

    const secondList = await second.agent.get('/api/v1/learning-paths/progress');
    expect(secondList.status).toBe(200);
    expect(secondList.body.data.enrollments).toEqual([]);
  });
});

describe('lesson completion', () => {
  it('completes and uncompletes lessons idempotently with accurate percentages', async () => {
    const session = await register('complete');
    const path = await createPath({
      modules: [
        {
          title: 'Module',
          lessons: [
            { title: 'Lesson one' },
            { title: 'Lesson two' },
            { title: 'Lesson three' },
          ],
        },
      ],
    });
    const [first, second, third] = path.lessons.map((lesson) => lesson.id) as [
      string,
      string,
      string,
    ];

    await enroll(session, path.id);

    const one = await completeLesson(session, path.id, first);
    expect(one.status).toBe(200);
    expect(progressOf(one)).toMatchObject({
      completedCount: 1,
      totalLessons: 3,
      percentage: 33,
      completedAt: null,
    });

    const repeated = await completeLesson(session, path.id, first);
    expect(repeated.status).toBe(200);
    expect(progressOf(repeated)).toMatchObject({ completedCount: 1, percentage: 33 });

    const two = await completeLesson(session, path.id, second);
    expect(progressOf(two)).toMatchObject({ completedCount: 2, percentage: 67 });

    const three = await completeLesson(session, path.id, third);
    expect(progressOf(three)).toMatchObject({
      completedCount: 3,
      totalLessons: 3,
      percentage: 100,
    });
    expect(progressOf(three).completedAt).toEqual(expect.any(String));

    const allAgain = await completeLesson(session, path.id, third);
    expect(progressOf(allAgain)).toMatchObject({ completedCount: 3, percentage: 100 });
    expect(progressOf(allAgain).completedAt).toBe(progressOf(three).completedAt);

    const undone = await uncompleteLesson(session, path.id, third);
    expect(undone.status).toBe(200);
    expect(progressOf(undone)).toMatchObject({
      completedCount: 2,
      percentage: 67,
      completedAt: null,
    });

    const undoneAgain = await uncompleteLesson(session, path.id, third);
    expect(progressOf(undoneAgain)).toMatchObject({ completedCount: 2, percentage: 67 });

    const stored = await LearningProgress.findOne({ user: session.user.id });
    expect(stored?.completedLessons).toHaveLength(2);
  });

  it('never reports more than 100 percent when duplicates exist in storage', async () => {
    const session = await register('complete-duplicates');
    const path = await createPath({
      modules: [{ title: 'Module', lessons: [{ title: 'Only lesson' }] }],
    });
    const lessonId = path.lessons[0]?.id as string;

    await enroll(session, path.id);
    await LearningProgress.updateOne(
      { user: session.user.id },
      { $set: { completedLessons: [lessonId, lessonId, lessonId] } },
    );

    const response = await session.agent.get(
      `/api/v1/learning-paths/${path.id}/progress`,
    );

    expect(response.status).toBe(200);
    expect(progressOf(response)).toMatchObject({
      completedCount: 1,
      totalLessons: 1,
      percentage: 100,
    });
    expect((progressOf(response).completedLessons as string[])).toHaveLength(1);
  });

  it('requires enrollment before marking a lesson complete', async () => {
    const session = await register('complete-not-enrolled');
    const path = await createPath({});
    const lessonId = path.lessons[0]?.id as string;

    const response = await completeLesson(session, path.id, lessonId);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NOT_ENROLLED');
  });

  it('rejects lessons that do not belong to the path', async () => {
    const session = await register('complete-foreign-lesson');
    const firstPath = await createPath({});
    const secondPath = await createPath({});
    const foreignLessonId = secondPath.lessons[0]?.id as string;

    await enroll(session, firstPath.id);
    await completeLesson(session, firstPath.id, firstPath.lessons[0]?.id as string);

    const response = await completeLesson(session, firstPath.id, foreignLessonId);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Lesson not found in this learning path');

    const progress = await session.agent.get(
      `/api/v1/learning-paths/${firstPath.id}/progress`,
    );
    expect(progressOf(progress)).toMatchObject({ completedCount: 1, percentage: 25 });
  });

  it('rejects malformed path and lesson identifiers', async () => {
    const session = await register('complete-malformed');
    const path = await createPath({});
    const lessonId = path.lessons[0]?.id as string;

    const badPath = await completeLesson(session, 'not-an-id', lessonId);
    expect(badPath.status).toBe(400);
    expect(badPath.body.error.code).toBe('VALIDATION_ERROR');

    const badLesson = await completeLesson(session, path.id, 'not-an-id');
    expect(badLesson.status).toBe(400);
    expect(badLesson.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles empty learning paths without exceeding valid percentages', async () => {
    const session = await register('complete-empty');
    const path = await createPath({ modules: [] });
    const otherPath = await createPath({});

    const enrollment = await enroll(session, path.id);
    expect(enrollment.status).toBe(201);
    expect(progressOf(enrollment)).toMatchObject({
      enrolled: true,
      completedCount: 0,
      totalLessons: 0,
      percentage: 0,
      completedAt: null,
    });

    const impossible = await completeLesson(
      session,
      path.id,
      otherPath.lessons[0]?.id as string,
    );
    expect(impossible.status).toBe(404);
    expect(impossible.body.error.message).toBe('Lesson not found in this learning path');

    const detail = await request(app).get(`/api/v1/learning-paths/${path.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.path.modules).toEqual([]);
  });
});

describe('progress isolation', () => {
  it('keeps completion data separate for two users on the same path', async () => {
    const first = await register('isolation-a');
    const second = await register('isolation-b');
    const path = await createPath({
      modules: [
        {
          title: 'Module',
          lessons: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }, { title: 'Four' }],
        },
      ],
    });

    await enroll(first, path.id);
    await enroll(second, path.id);
    await completeLesson(first, path.id, path.lessons[0]?.id as string);
    await completeLesson(first, path.id, path.lessons[1]?.id as string);

    const firstProgress = await first.agent.get(
      `/api/v1/learning-paths/${path.id}/progress`,
    );
    expect(progressOf(firstProgress)).toMatchObject({
      completedCount: 2,
      totalLessons: 4,
      percentage: 50,
    });

    const secondProgress = await second.agent.get(
      `/api/v1/learning-paths/${path.id}/progress`,
    );
    expect(progressOf(secondProgress)).toMatchObject({
      completedCount: 0,
      totalLessons: 4,
      percentage: 0,
      completedLessons: [],
    });

    const records = await LearningProgress.find({ learningPath: path.id });
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.user.toString()).sort()).toEqual(
      [first.user.id, second.user.id].sort(),
    );
  });
});
