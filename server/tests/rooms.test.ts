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
import { Project } from '../src/models/Project.js';
import { Room } from '../src/models/Room.js';
import { User } from '../src/models/User.js';

const app = createApp();
const PASSWORD = 'correct horse battery staple';
let userCounter = 0;
let pathCounter = 0;

type TestAgent = ReturnType<typeof request.agent>;

interface TestSession {
  agent: TestAgent;
  user: { id: string; email: string; displayName: string };
  csrfToken: string;
}

interface RoomDetail {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  ownerId: string;
  inviteCode: string;
  memberCount: number;
  viewerRole: 'owner' | 'member';
  hasLinkedProject: boolean;
  hasLinkedLearningPath: boolean;
  members: Array<{
    userId: string;
    displayName: string;
    role: 'owner' | 'member';
    joinedAt: string;
  }>;
  linkedProject: { id: string; name: string } | null;
  linkedLearningPath: { id: string; title: string; slug: string } | null;
}

function uniqueEmail(label: string): string {
  userCounter += 1;
  return `${label}-${userCounter}-${Date.now()}@example.com`;
}

async function register(label: string, displayName = 'Room Tester'): Promise<TestSession> {
  const agent = request.agent(app);
  const csrfResponse = await agent.get('/api/v1/auth/csrf');
  const email = uniqueEmail(label);

  const response = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfResponse.body.data.csrfToken as string)
    .send({ email, password: PASSWORD, displayName });

  expect(response.status).toBe(201);

  return {
    agent,
    user: response.body.data.user as TestSession['user'],
    csrfToken: response.body.data.csrfToken as string,
  };
}

function createRoomRequest(
  session: TestSession,
  body: Record<string, unknown>,
  includeCsrf = true,
) {
  const pending = session.agent.post('/api/v1/rooms');

  if (includeCsrf) {
    pending.set('x-csrf-token', session.csrfToken);
  }

  return pending.send(body);
}

async function createRoomSuccessfully(
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<RoomDetail> {
  const response = await createRoomRequest(session, {
    name: 'Pair Programming Lab',
    description: 'A shared room for deliberate practice',
    ...overrides,
  });

  expect(response.status).toBe(201);
  return response.body.data.room as RoomDetail;
}

function updateRoomRequest(
  session: TestSession,
  roomId: string,
  body: Record<string, unknown>,
  includeCsrf = true,
) {
  const pending = session.agent.patch(`/api/v1/rooms/${roomId}`);

  if (includeCsrf) {
    pending.set('x-csrf-token', session.csrfToken);
  }

  return pending.send(body);
}

function deleteRoomRequest(session: TestSession, roomId: string, includeCsrf = true) {
  const pending = session.agent.delete(`/api/v1/rooms/${roomId}`);
  return includeCsrf ? pending.set('x-csrf-token', session.csrfToken) : pending;
}

function joinRoomRequest(
  session: TestSession,
  inviteCode: string,
  includeCsrf = true,
) {
  const pending = session.agent.post('/api/v1/rooms/join');

  if (includeCsrf) {
    pending.set('x-csrf-token', session.csrfToken);
  }

  return pending.send({ inviteCode });
}

function leaveRoomRequest(session: TestSession, roomId: string, includeCsrf = true) {
  const pending = session.agent.post(`/api/v1/rooms/${roomId}/leave`);
  return includeCsrf ? pending.set('x-csrf-token', session.csrfToken) : pending;
}

function rotateRequest(session: TestSession, roomId: string, includeCsrf = true) {
  const pending = session.agent.post(`/api/v1/rooms/${roomId}/invite-code/rotate`);
  return includeCsrf ? pending.set('x-csrf-token', session.csrfToken) : pending;
}

async function createProjectSuccessfully(
  session: TestSession,
  name = 'Owned Project',
): Promise<{ id: string; name: string }> {
  const response = await session.agent
    .post('/api/v1/projects')
    .set('x-csrf-token', session.csrfToken)
    .send({ name, description: 'Project linked to a room' });

  expect(response.status).toBe(201);
  return response.body.data.project as { id: string; name: string };
}

async function createLearningPath(
  status: 'draft' | 'published' = 'published',
): Promise<{ id: string; title: string; slug: string }> {
  pathCounter += 1;
  const title = `Room Test Path ${pathCounter}`;
  const slug = `room-test-path-${pathCounter}-${Date.now()}`;

  const path = await LearningPath.create({
    title,
    slug,
    shortDescription: 'A path used by room tests',
    detailedDescription: 'A path used to verify room associations.',
    difficulty: 'beginner',
    category: 'Testing',
    estimatedDurationMinutes: 60,
    status,
    modules: [
      {
        title: 'Module',
        description: 'Module description',
        position: 0,
        lessons: [
          {
            title: 'Lesson',
            shortDescription: 'Lesson summary',
            content: 'Lesson content',
            estimatedDurationMinutes: 10,
            type: 'reading',
            position: 0,
          },
        ],
      },
    ],
  });

  return { id: path._id.toString(), title, slug };
}

beforeAll(async () => {
  await connectDatabase();

  if (!mongoose.connection.name.endsWith('_test')) {
    throw new Error('Refusing to run integration tests against a non-test database');
  }

  await User.init();
  await Project.init();
  await LearningPath.init();
  await Room.init();
});

beforeEach(async () => {
  await Room.deleteMany({});
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

describe('POST /api/v1/rooms', () => {
  it('creates an owner-membership room with an invite code and valid links', async () => {
    const session = await register('room-create', 'Room Owner');
    const project = await createProjectSuccessfully(session);
    const path = await createLearningPath();

    const response = await createRoomRequest(session, {
      name: '  Algorithms Lab  ',
      description: '  Practice together  ',
      projectId: project.id,
      learningPathId: path.id,
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');

    const room = response.body.data.room as RoomDetail;
    expect(room.id).toEqual(expect.any(String));
    expect(room.name).toBe('Algorithms Lab');
    expect(room.description).toBe('Practice together');
    expect(room.status).toBe('active');
    expect(room.ownerId).toBe(session.user.id);
    expect(room.memberCount).toBe(1);
    expect(room.viewerRole).toBe('owner');
    expect(room.hasLinkedProject).toBe(true);
    expect(room.hasLinkedLearningPath).toBe(true);
    expect(room.inviteCode).toMatch(/^[0-9a-f]{32}$/);
    expect(room.members).toEqual([
      expect.objectContaining({
        userId: session.user.id,
        displayName: 'Room Owner',
        role: 'owner',
      }),
    ]);
    expect(room.linkedProject).toEqual({ id: project.id, name: 'Owned Project' });
    expect(room.linkedLearningPath).toEqual({
      id: path.id,
      title: path.title,
      slug: path.slug,
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const stored = await Room.findById(room.id);
    expect(stored).not.toBeNull();
    expect(stored?.members).toHaveLength(1);
    expect(stored?.members[0]?.role).toBe('owner');

    const indexes = await Room.collection.indexes();
    const inviteIndex = indexes.find((index) => index.key.inviteCode === 1);
    expect(inviteIndex?.unique).toBe(true);
  });

  it('rejects invalid fields and client-supplied ownership or membership data', async () => {
    const session = await register('room-validation');
    const other = await register('room-validation-other');

    const invalidBodies = [
      { description: 'Missing name' },
      { name: '   ' },
      { name: 'x'.repeat(121) },
      { name: 'Unknown field', extra: true },
      {
        name: 'Forged owner',
        owner: other.user.id,
      },
      {
        name: 'Forged members',
        members: [{ user: other.user.id, role: 'owner', joinedAt: new Date().toISOString() }],
      },
      { name: 'Forged invite', inviteCode: 'fixed-code' },
      { name: 'Forged role', role: 'owner' },
    ];

    for (const body of invalidBodies) {
      const response = await createRoomRequest(session, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    expect(await Room.countDocuments({})).toBe(0);
  });

  it('rejects project links the owner does not own and unpublished paths', async () => {
    const session = await register('room-links');
    const other = await register('room-links-other');
    const otherProject = await createProjectSuccessfully(other, 'Other Project');
    const draftPath = await createLearningPath('draft');

    const foreignProject = await createRoomRequest(session, {
      name: 'Foreign project room',
      projectId: otherProject.id,
    });
    expect(foreignProject.status).toBe(400);
    expect(foreignProject.body.error.code).toBe('INVALID_PROJECT_REFERENCE');

    const unpublishedPath = await createRoomRequest(session, {
      name: 'Draft path room',
      learningPathId: draftPath.id,
    });
    expect(unpublishedPath.status).toBe(400);
    expect(unpublishedPath.body.error.code).toBe('INVALID_LEARNING_PATH_REFERENCE');

    const missingReference = await createRoomRequest(session, {
      name: 'Missing reference',
      projectId: new Types.ObjectId().toString(),
      learningPathId: new Types.ObjectId().toString(),
    });
    expect(missingReference.status).toBe(400);
    expect(await Room.countDocuments({})).toBe(0);
  });

  it('enforces owner and unique membership invariants in the model', async () => {
    const session = await register('room-invariants');
    const other = await register('room-invariants-other');

    await expect(
      Room.create({
        name: 'No owner member',
        inviteCode: 'a'.repeat(32),
        owner: session.user.id,
        members: [{ user: other.user.id, role: 'member', joinedAt: new Date() }],
      }),
    ).rejects.toThrow();

    await expect(
      Room.create({
        name: 'Duplicate member',
        inviteCode: 'b'.repeat(32),
        owner: session.user.id,
        members: [
          { user: session.user.id, role: 'owner', joinedAt: new Date() },
          { user: session.user.id, role: 'member', joinedAt: new Date() },
        ],
      }),
    ).rejects.toThrow();

    await expect(
      Room.create({
        name: 'Two owners',
        inviteCode: 'c'.repeat(32),
        owner: session.user.id,
        members: [
          { user: session.user.id, role: 'owner', joinedAt: new Date() },
          { user: other.user.id, role: 'owner', joinedAt: new Date() },
        ],
      }),
    ).rejects.toThrow();
  });
});

describe('room listing and detail access', () => {
  it('lists only rooms the current user belongs to, without invite codes or member lists', async () => {
    const first = await register('room-list-a');
    const second = await register('room-list-b');
    const firstRoom = await createRoomSuccessfully(first, { name: 'First Room' });
    const secondRoom = await createRoomSuccessfully(second, { name: 'Second Room' });

    const firstList = await first.agent.get('/api/v1/rooms');
    expect(firstList.status).toBe(200);
    expect(firstList.headers['cache-control']).toBe('no-store');
    expect(firstList.body.data.rooms).toHaveLength(1);
    expect(firstList.body.data.rooms[0]).toMatchObject({
      id: firstRoom.id,
      name: 'First Room',
      viewerRole: 'owner',
      memberCount: 1,
    });
    expect(firstList.body.data.rooms[0]).not.toHaveProperty('inviteCode');
    expect(firstList.body.data.rooms[0]).not.toHaveProperty('members');

    const secondList = await second.agent.get('/api/v1/rooms');
    expect(secondList.body.data.rooms).toHaveLength(1);
    expect(secondList.body.data.rooms[0]?.id).toBe(secondRoom.id);
  });

  it('allows members to read details and hides rooms from non-members', async () => {
    const owner = await register('room-detail-owner');
    const member = await register('room-detail-member');
    const outsider = await register('room-detail-outsider');
    const room = await createRoomSuccessfully(owner);

    const joined = await joinRoomRequest(member, room.inviteCode);
    expect(joined.status).toBe(200);

    const ownerDetail = await owner.agent.get(`/api/v1/rooms/${room.id}`);
    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.headers['cache-control']).toBe('no-store');
    expect(ownerDetail.body.data.room.viewerRole).toBe('owner');
    expect(ownerDetail.body.data.room.inviteCode).toBe(room.inviteCode);

    const memberDetail = await member.agent.get(`/api/v1/rooms/${room.id}`);
    expect(memberDetail.status).toBe(200);
    expect(memberDetail.body.data.room.viewerRole).toBe('member');
    expect(memberDetail.body.data.room.members).toHaveLength(2);

    const outsiderDetail = await outsider.agent.get(`/api/v1/rooms/${room.id}`);
    const unknownDetail = await outsider.agent.get(
      `/api/v1/rooms/${new Types.ObjectId().toString()}`,
    );
    expect(outsiderDetail.status).toBe(404);
    expect(unknownDetail.status).toBe(404);
    expect(outsiderDetail.body.error.message).toBe(unknownDetail.body.error.message);

    const malformed = await outsider.agent.get('/api/v1/rooms/not-an-id');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('room updates, deletion, and owner permissions', () => {
  it('restricts updates and deletion to the owner', async () => {
    const owner = await register('room-owner-permissions');
    const member = await register('room-member-permissions');
    const room = await createRoomSuccessfully(owner);

    await joinRoomRequest(member, room.inviteCode);

    const memberUpdate = await updateRoomRequest(member, room.id, { name: 'Hijacked' });
    expect(memberUpdate.status).toBe(404);

    const memberDelete = await deleteRoomRequest(member, room.id);
    expect(memberDelete.status).toBe(404);

    const memberRotate = await rotateRequest(member, room.id);
    expect(memberRotate.status).toBe(404);

    const ownerUpdate = await updateRoomRequest(owner, room.id, {
      name: 'Updated Room',
      description: 'Updated description',
      status: 'archived',
    });
    expect(ownerUpdate.status).toBe(200);
    expect(ownerUpdate.body.data.room).toMatchObject({
      name: 'Updated Room',
      description: 'Updated description',
      status: 'archived',
    });

    const forgedUpdate = await updateRoomRequest(owner, room.id, {
      owner: member.user.id,
      members: [],
    });
    expect(forgedUpdate.status).toBe(400);
    expect(forgedUpdate.body.error.code).toBe('VALIDATION_ERROR');

    const stored = await Room.findById(room.id);
    expect(stored?.owner.toString()).toBe(owner.user.id);
    expect(stored?.members).toHaveLength(2);

    const ownerDelete = await deleteRoomRequest(owner, room.id);
    expect(ownerDelete.status).toBe(204);
    expect(await Room.countDocuments({})).toBe(0);
    expect((await owner.agent.get(`/api/v1/rooms/${room.id}`)).status).toBe(404);
  });

  it('validates replacement project links on update and allows clearing them', async () => {
    const owner = await register('room-update-link-owner');
    const other = await register('room-update-link-other');
    const ownedProject = await createProjectSuccessfully(owner, 'Owned Link');
    const foreignProject = await createProjectSuccessfully(other, 'Foreign Link');
    const path = await createLearningPath();
    const room = await createRoomSuccessfully(owner, {
      projectId: ownedProject.id,
      learningPathId: path.id,
    });

    const foreignLink = await updateRoomRequest(owner, room.id, {
      projectId: foreignProject.id,
    });
    expect(foreignLink.status).toBe(400);
    expect(foreignLink.body.error.code).toBe('INVALID_PROJECT_REFERENCE');

    const cleared = await updateRoomRequest(owner, room.id, {
      projectId: null,
      learningPathId: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.room.hasLinkedProject).toBe(false);
    expect(cleared.body.data.room.hasLinkedLearningPath).toBe(false);
    expect(cleared.body.data.room.linkedProject).toBeNull();
    expect(cleared.body.data.room.linkedLearningPath).toBeNull();
  });
});

describe('joining rooms', () => {
  it('joins by invite code, deduplicates repeat joins, and records member roles', async () => {
    const owner = await register('room-join-owner');
    const member = await register('room-join-member');
    const room = await createRoomSuccessfully(owner);

    const firstJoin = await joinRoomRequest(member, room.inviteCode);
    expect(firstJoin.status).toBe(200);
    expect(firstJoin.headers['cache-control']).toBe('no-store');
    expect(firstJoin.body.data.alreadyMember).toBe(false);
    expect(firstJoin.body.data.room).toMatchObject({
      id: room.id,
      memberCount: 2,
      viewerRole: 'member',
    });
    expect(firstJoin.body.data.room.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.user.id, role: 'owner' }),
        expect.objectContaining({ userId: member.user.id, role: 'member' }),
      ]),
    );

    const repeatJoin = await joinRoomRequest(member, room.inviteCode);
    expect(repeatJoin.status).toBe(200);
    expect(repeatJoin.body.data.alreadyMember).toBe(true);

    const stored = await Room.findById(room.id);
    expect(stored?.members).toHaveLength(2);
    expect(stored?.members.filter((entry) => entry.user.toString() === member.user.id)).toHaveLength(
      1,
    );

    const memberList = await member.agent.get('/api/v1/rooms');
    expect(memberList.body.data.rooms.map((entry: { id: string }) => entry.id)).toEqual([room.id]);
  });

  it('returns safe errors for invalid codes and rejects forged join payloads', async () => {
    const session = await register('room-join-invalid');
    const room = await createRoomSuccessfully(session);

    const invalid = await joinRoomRequest(session, 'not-a-real-code');
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.message).toBe('Room not found');
    expect(invalid.body.error).not.toHaveProperty('details');

    const forged = await session.agent
      .post('/api/v1/rooms/join')
      .set('x-csrf-token', session.csrfToken)
      .send({ inviteCode: room.inviteCode, userId: new Types.ObjectId().toString(), role: 'owner' });
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects joins to archived rooms until the owner reactivates them', async () => {
    const owner = await register('room-archive-owner');
    const member = await register('room-archive-member');
    const room = await createRoomSuccessfully(owner);

    const archived = await updateRoomRequest(owner, room.id, { status: 'archived' });
    expect(archived.status).toBe(200);

    const blockedJoin = await joinRoomRequest(member, room.inviteCode);
    expect(blockedJoin.status).toBe(409);
    expect(blockedJoin.body.error.code).toBe('ROOM_ARCHIVED');

    const reactivated = await updateRoomRequest(owner, room.id, { status: 'active' });
    expect(reactivated.status).toBe(200);

    const allowedJoin = await joinRoomRequest(member, room.inviteCode);
    expect(allowedJoin.status).toBe(200);
  });
});

describe('invite-code rotation', () => {
  it('invalidates the old code and accepts only the new code', async () => {
    const owner = await register('room-rotate-owner');
    const member = await register('room-rotate-member');
    const room = await createRoomSuccessfully(owner);
    const oldCode = room.inviteCode;

    const rotated = await rotateRequest(owner, room.id);
    expect(rotated.status).toBe(200);
    expect(rotated.headers['cache-control']).toBe('no-store');

    const newCode = rotated.body.data.room.inviteCode as string;
    expect(newCode).not.toBe(oldCode);

    const oldJoin = await joinRoomRequest(member, oldCode);
    expect(oldJoin.status).toBe(404);

    const newJoin = await joinRoomRequest(member, newCode);
    expect(newJoin.status).toBe(200);

    const memberRotate = await rotateRequest(member, room.id);
    expect(memberRotate.status).toBe(404);

    const stored = await Room.findById(room.id);
    expect(stored?.inviteCode).toBe(newCode);
  });
});

describe('leaving rooms', () => {
  it('lets members leave but blocks owners from leaving', async () => {
    const owner = await register('room-leave-owner');
    const member = await register('room-leave-member');
    const room = await createRoomSuccessfully(owner);

    await joinRoomRequest(member, room.inviteCode);

    const left = await leaveRoomRequest(member, room.id);
    expect(left.status).toBe(204);

    const detailAfterLeave = await member.agent.get(`/api/v1/rooms/${room.id}`);
    expect(detailAfterLeave.status).toBe(404);

    const listAfterLeave = await member.agent.get('/api/v1/rooms');
    expect(listAfterLeave.body.data.rooms).toEqual([]);

    const ownerLeave = await leaveRoomRequest(owner, room.id);
    expect(ownerLeave.status).toBe(409);
    expect(ownerLeave.body.error.code).toBe('OWNER_CANNOT_LEAVE');

    const stored = await Room.findById(room.id);
    expect(stored?.members).toHaveLength(1);
    expect(stored?.members[0]?.role).toBe('owner');
  });
});

describe('room isolation and private associations', () => {
  it('keeps rooms and linked project details isolated between accounts', async () => {
    const owner = await register('room-isolation-owner');
    const member = await register('room-isolation-member');
    const outsider = await register('room-isolation-outsider');
    const project = await createProjectSuccessfully(owner, 'Private Owner Project');
    const room = await createRoomSuccessfully(owner, { projectId: project.id });

    await joinRoomRequest(member, room.inviteCode);

    const memberDetail = await member.agent.get(`/api/v1/rooms/${room.id}`);
    expect(memberDetail.status).toBe(200);
    expect(memberDetail.body.data.room.hasLinkedProject).toBe(true);
    expect(memberDetail.body.data.room.linkedProject).toBeNull();

    const outsiderList = await outsider.agent.get('/api/v1/rooms');
    expect(outsiderList.body.data.rooms).toEqual([]);

    const outsiderDetail = await outsider.agent.get(`/api/v1/rooms/${room.id}`);
    expect(outsiderDetail.status).toBe(404);

    const outsiderProject = await outsider.agent.get(`/api/v1/projects/${project.id}`);
    expect(outsiderProject.status).toBe(404);
  });
});

describe('room authentication and CSRF', () => {
  it('requires authentication on every room endpoint', async () => {
    const roomId = new Types.ObjectId().toString();

    const requests = [
      request(app).get('/api/v1/rooms'),
      request(app).post('/api/v1/rooms').send({ name: 'Anonymous' }),
      request(app).get(`/api/v1/rooms/${roomId}`),
      request(app).patch(`/api/v1/rooms/${roomId}`).send({ name: 'Anonymous' }),
      request(app).delete(`/api/v1/rooms/${roomId}`),
      request(app).post('/api/v1/rooms/join').send({ inviteCode: 'code' }),
      request(app).post(`/api/v1/rooms/${roomId}/leave`),
      request(app).post(`/api/v1/rooms/${roomId}/invite-code/rotate`),
    ];

    for (const pending of requests) {
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('requires CSRF tokens on all room mutations', async () => {
    const owner = await register('room-csrf-owner');
    const room = await createRoomSuccessfully(owner);

    const missingCreate = await createRoomRequest(owner, { name: 'No CSRF' }, false);
    expect(missingCreate.status).toBe(403);
    expect(missingCreate.body.error.code).toBe('CSRF_INVALID');

    const missingJoin = await joinRoomRequest(owner, room.inviteCode, false);
    expect(missingJoin.status).toBe(403);
    expect(missingJoin.body.error.code).toBe('CSRF_INVALID');

    const missingUpdate = await updateRoomRequest(owner, room.id, { name: 'No CSRF' }, false);
    expect(missingUpdate.status).toBe(403);

    const missingDelete = await deleteRoomRequest(owner, room.id, false);
    expect(missingDelete.status).toBe(403);

    const missingLeave = await leaveRoomRequest(owner, room.id, false);
    expect(missingLeave.status).toBe(403);

    const missingRotate = await rotateRequest(owner, room.id, false);
    expect(missingRotate.status).toBe(403);
  });
});

describe('room join rate limiting', () => {
  it(
    'limits repeated failed invite-code attempts with a safe error',
    async () => {
      const session = await register('room-rate-limit');
      let limitedResponse: request.Response | null = null;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const response = await joinRoomRequest(session, `invalid-code-${attempt}`);

        if (response.status === 429) {
          limitedResponse = response;
          break;
        }

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      }

      expect(limitedResponse).not.toBeNull();
      expect(limitedResponse?.body.error.code).toBe('ROOM_JOIN_RATE_LIMITED');
      expect(limitedResponse?.body.error.message).toBe(
        'Too many room join attempts. Try again later.',
      );
      expect(JSON.stringify(limitedResponse?.body)).not.toContain('stack');
    },
    30_000,
  );
});
