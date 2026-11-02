import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import { createApp } from '../src/app.js';
import { closeSessionStore } from '../src/config/session.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { LearningPath } from '../src/models/LearningPath.js';
import { Project } from '../src/models/Project.js';
import { Room } from '../src/models/Room.js';
import { User } from '../src/models/User.js';
import type {
  ClientToServerEvents,
  DocumentMessage,
  PresenceMemberEvent,
  PresenceSnapshot,
  RealtimeError,
  RoomAccessRevoked,
  RoomActionResult,
  ServerToClientEvents,
} from '../src/realtime/events.js';
import { DocumentHub } from '../src/realtime/documents.js';
import { closeRealtime, initializeRealtime } from '../src/realtime/index.js';
import type { RealtimeServer } from '../src/realtime/server.js';

const app = createApp();
const PASSWORD = 'correct horse battery staple';
let userCounter = 0;

type RoomSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type TestAgent = ReturnType<typeof request.agent>;

interface TestSession {
  agent: TestAgent;
  user: { id: string; email: string; displayName: string };
  csrfToken: string;
  cookie: string;
}

interface RoomDetail {
  id: string;
  name: string;
  inviteCode: string;
}

let httpServer: HttpServer;
let realtime: RealtimeServer;
let socketUrl: string;
const openSockets: RoomSocket[] = [];

function uniqueEmail(label: string): string {
  userCounter += 1;
  return `${label}-${userCounter}-${Date.now()}@example.com`;
}

function sessionCookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie'] as string | string[] | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('ct.sid='));

  if (!sessionCookie) {
    throw new Error('Registration did not set a session cookie');
  }

  return sessionCookie.split(';')[0] as string;
}

async function register(label: string, displayName = 'Realtime Tester'): Promise<TestSession> {
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
    cookie: sessionCookieFrom(response),
  };
}

async function createRoom(session: TestSession, name: string): Promise<RoomDetail> {
  const response = await session.agent
    .post('/api/v1/rooms')
    .set('x-csrf-token', session.csrfToken)
    .send({ name });

  expect(response.status).toBe(201);
  return response.body.data.room as RoomDetail;
}

async function joinRoomViaRest(session: TestSession, inviteCode: string): Promise<void> {
  const response = await session.agent
    .post('/api/v1/rooms/join')
    .set('x-csrf-token', session.csrfToken)
    .send({ inviteCode });

  expect(response.status).toBe(200);
}

function openSocket(
  cookie?: string,
  options: { origin?: string } = {},
): RoomSocket {
  const headers: Record<string, string> = {};

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (options.origin) {
    headers.Origin = options.origin;
  }

  const socket = createSocketClient(socketUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    autoConnect: false,
    extraHeaders: headers,
  }) as RoomSocket;

  openSockets.push(socket);
  return socket;
}

async function connectSocket(cookie: string): Promise<RoomSocket> {
  const socket = openSocket(cookie);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out connecting the socket'));
    }, 3_000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
    };

    const handleConnect = () => {
      cleanup();
      resolve();
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.connect();
  });

  return socket;
}

function waitForConnectError(socket: RoomSocket): Promise<Error> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for a connection error'));
    }, 3_000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
    };

    const handleConnect = () => {
      cleanup();
      reject(new Error('Socket unexpectedly connected'));
    };

    const handleError = (error: Error) => {
      cleanup();
      resolve(error);
    };

    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.connect();
  });
}

function waitForEvent<K extends keyof ServerToClientEvents>(
  socket: RoomSocket,
  event: K,
  timeoutMs = 3_000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  type Payload = Parameters<ServerToClientEvents[K]>[0];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handleEvent as never);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const handleEvent = (payload: Payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, handleEvent as never);
  });
}

function emitRoomAction(
  socket: RoomSocket,
  event: 'room:join' | 'room:leave',
  payload: unknown,
): Promise<RoomActionResult> {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function emitDocumentAction(
  socket: RoomSocket,
  event: 'document:subscribe' | 'document:unsubscribe' | 'document:message',
  payload: unknown,
): Promise<RoomActionResult> {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function encodeDocumentUpdate(doc: Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  syncProtocol.writeUpdate(encoder, encodeStateAsUpdate(doc));
  return encoding.toUint8Array(encoder);
}

function encodeSyncStep1(doc: Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

function applyServerDocumentMessage(doc: Doc, message: Uint8Array): void {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  if (
    messageType === syncProtocol.messageYjsSyncStep2 ||
    messageType === syncProtocol.messageYjsUpdate
  ) {
    applyUpdate(doc, decoding.readVarUint8Array(decoder));
  }
}

function subscribeDocument(
  socket: RoomSocket,
  roomId: string,
): Promise<RoomActionResult> {
  return emitDocumentAction(socket, 'document:subscribe', {
    roomId,
    documentId: 'main',
  });
}

function sendDocumentMessage(
  socket: RoomSocket,
  roomId: string,
  message: Uint8Array,
): Promise<RoomActionResult> {
  return emitDocumentAction(socket, 'document:message', {
    roomId,
    documentId: 'main',
    message,
  });
}

function collectDocumentMessages(
  socket: RoomSocket,
  count: number,
  timeoutMs = 3_000,
): Promise<DocumentMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: DocumentMessage[] = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${count} document messages`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('document:message', handleMessage);
    };

    const handleMessage = (payload: DocumentMessage) => {
      messages.push(payload);

      if (messages.length >= count) {
        cleanup();
        resolve(messages);
      }
    };

    socket.on('document:message', handleMessage);
  });
}

async function connectAndJoin(
  cookie: string,
  roomId: string,
): Promise<{ socket: RoomSocket; snapshot: PresenceSnapshot }> {
  const socket = await connectSocket(cookie);
  const snapshotPromise = waitForEvent(socket, 'presence:snapshot');
  const result = await emitRoomAction(socket, 'room:join', { roomId });

  expect(result).toEqual({ ok: true });

  return { socket, snapshot: await snapshotPromise };
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for condition');
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

  httpServer = createServer(app);
  realtime = initializeRealtime(httpServer, { sessionRevalidationIntervalMs: 0 });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address() as AddressInfo;
  socketUrl = `http://127.0.0.1:${address.port}`;
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

afterEach(() => {
  for (const socket of openSockets.splice(0)) {
    socket.disconnect();
  }
});

afterAll(async () => {
  await closeRealtime();

  if (httpServer.listening) {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  }

  await mongoose.connection.dropDatabase();
  await closeSessionStore();
  await disconnectDatabase();
});

describe('Socket.IO authentication and origin checks', () => {
  it('rejects connections without a server-side session', async () => {
    const socket = openSocket();
    const error = await waitForConnectError(socket);

    expect(error.message).toBe('Authentication required');
    expect((error as Error & { data?: { code?: string } }).data?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects browser origins outside the configured allowlist', async () => {
    const session = await register('realtime-cors');
    await createRoom(session, 'CORS Room');
    const socket = openSocket(session.cookie, { origin: 'https://evil.example' });

    await expect(waitForConnectError(socket)).resolves.toBeInstanceOf(Error);
    expect(socket.connected).toBe(false);
  });
});

describe('presence snapshots and lifecycle', () => {
  it('tracks multiple connections per user and emits joined/left transitions once', async () => {
    const owner = await register('realtime-owner', 'Owner One');
    const member = await register('realtime-member', 'Member Two');
    const room = await createRoom(owner, 'Presence Lab');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerJoin = await connectAndJoin(owner.cookie, room.id);
    expect(ownerJoin.snapshot.onlineMembers).toEqual([
      { userId: owner.user.id, displayName: 'Owner One' },
    ]);

    const joinedPromise = waitForEvent(
      ownerJoin.socket,
      'presence:member_joined',
    );
    const memberFirst = await connectAndJoin(member.cookie, room.id);

    expect(memberFirst.snapshot.onlineMembers).toEqual([
      { userId: member.user.id, displayName: 'Member Two' },
      { userId: owner.user.id, displayName: 'Owner One' },
    ]);
    await expect(joinedPromise).resolves.toEqual({
      roomId: room.id,
      member: { userId: member.user.id, displayName: 'Member Two' },
    });

    const duplicateSnapshot = waitForEvent(
      memberFirst.socket,
      'presence:snapshot',
    );
    expect(await emitRoomAction(memberFirst.socket, 'room:join', { roomId: room.id })).toEqual({
      ok: true,
    });
    expect((await duplicateSnapshot).onlineMembers).toHaveLength(2);

    const memberSecond = await connectAndJoin(member.cookie, room.id);
    expect(memberSecond.snapshot.onlineMembers).toHaveLength(2);
    expect(
      memberSecond.snapshot.onlineMembers.filter((entry) => entry.userId === member.user.id),
    ).toHaveLength(1);

    expect(await emitRoomAction(memberFirst.socket, 'room:leave', { roomId: room.id })).toEqual({
      ok: true,
    });
    expect(
      realtime.getOnlineMembers(room.id).filter((entry) => entry.userId === member.user.id),
    ).toHaveLength(1);

    const leftPromise = waitForEvent(
      ownerJoin.socket,
      'presence:member_left',
    );
    memberSecond.socket.disconnect();
    await expect(leftPromise).resolves.toEqual({
      roomId: room.id,
      member: { userId: member.user.id, displayName: 'Member Two' },
    });

    const reconnect = await connectAndJoin(member.cookie, room.id);
    expect(reconnect.snapshot.onlineMembers).toHaveLength(2);
  });

  it('rejects malformed payloads, non-members, and unsupported events safely', async () => {
    const owner = await register('realtime-validation-owner');
    const outsider = await register('realtime-validation-outsider');
    const room = await createRoom(owner, 'Validation Room');
    const outsiderJoin = await connectAndJoinOwnOnly(outsider.cookie);

    expect(
      await emitRoomAction(outsiderJoin, 'room:join', { roomId: 'not-an-object-id' }),
    ).toEqual({
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid room payload' },
    });

    expect(
      await emitRoomAction(outsiderJoin, 'room:join', {
        roomId: new Types.ObjectId().toString(),
        extra: true,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid room payload' },
    });

    expect(
      await emitRoomAction(outsiderJoin, 'room:join', {
        roomId: new Types.ObjectId().toString(),
      }),
    ).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Room not found' },
    });

    expect(await emitRoomAction(outsiderJoin, 'room:join', { roomId: room.id })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Room not found' },
    });

    const unsupportedAck = await new Promise<RoomActionResult>((resolve) => {
      (outsiderJoin as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
        'room:unknown',
        { roomId: room.id },
        resolve,
      );
    });
    expect(unsupportedAck).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_EVENT', message: 'Unsupported event' },
    });

    const unsupportedEvent = waitForEvent(outsiderJoin, 'presence:error');
    (outsiderJoin as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'room:unknown',
      { roomId: room.id },
    );
    await expect(unsupportedEvent).resolves.toEqual({
      code: 'UNSUPPORTED_EVENT',
      message: 'Unsupported event',
    });
  });

  it('rate limits repeated room actions per socket', async () => {
    const owner = await register('realtime-rate-limit');
    const socket = await connectAndJoinOwnOnly(owner.cookie);
    let lastResult: RoomActionResult | null = null;

    for (let attempt = 0; attempt < 21; attempt += 1) {
      lastResult = await emitRoomAction(socket, 'room:join', { roomId: 'bad-room-id' });
    }

    expect(lastResult).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Too many room actions. Try again shortly.' },
    });
  });
});

async function connectAndJoinOwnOnly(cookie: string): Promise<RoomSocket> {
  return connectSocket(cookie);
}

describe('room access revocation', () => {
  it('revokes presence when a member leaves through the REST API', async () => {
    const owner = await register('realtime-leave-owner', 'Owner');
    const member = await register('realtime-leave-member', 'Leaver');
    const room = await createRoom(owner, 'Leave Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerJoin = await connectAndJoin(owner.cookie, room.id);
    const memberJoin = await connectAndJoin(member.cookie, room.id);

    const revokedPromise = waitForEvent(
      memberJoin.socket,
      'room:access_revoked',
    );
    const leftPromise = waitForEvent(
      ownerJoin.socket,
      'presence:member_left',
    );

    const response = await member.agent
      .post(`/api/v1/rooms/${room.id}/leave`)
      .set('x-csrf-token', member.csrfToken);

    expect(response.status).toBe(204);
    await expect(revokedPromise).resolves.toEqual({
      roomId: room.id,
      reason: 'MEMBERSHIP_REVOKED',
    });
    await expect(leftPromise).resolves.toEqual({
      roomId: room.id,
      member: { userId: member.user.id, displayName: 'Leaver' },
    });
    expect(realtime.getOnlineMembers(room.id)).toEqual([
      { userId: owner.user.id, displayName: 'Owner' },
    ]);

    expect(await emitRoomAction(memberJoin.socket, 'room:join', { roomId: room.id })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Room not found' },
    });
  });

  it('closes presence for every member when the room is deleted or archived', async () => {
    const owner = await register('realtime-delete-owner', 'Owner');
    const member = await register('realtime-delete-member', 'Member');
    const room = await createRoom(owner, 'Delete Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerJoin = await connectAndJoin(owner.cookie, room.id);
    const memberJoin = await connectAndJoin(member.cookie, room.id);

    const ownerRevoked = waitForEvent(
      ownerJoin.socket,
      'room:access_revoked',
    );
    const memberRevoked = waitForEvent(
      memberJoin.socket,
      'room:access_revoked',
    );

    const deleted = await owner.agent
      .delete(`/api/v1/rooms/${room.id}`)
      .set('x-csrf-token', owner.csrfToken);

    expect(deleted.status).toBe(204);
    await expect(ownerRevoked).resolves.toEqual({ roomId: room.id, reason: 'ROOM_DELETED' });
    await expect(memberRevoked).resolves.toEqual({ roomId: room.id, reason: 'ROOM_DELETED' });
    expect(realtime.getOnlineMembers(room.id)).toEqual([]);

    const archivedRoom = await createRoom(owner, 'Archive Room');
    await joinRoomViaRest(member, archivedRoom.inviteCode);

    const archiveOwnerJoin = await connectAndJoin(owner.cookie, archivedRoom.id);
    const archiveMemberJoin = await connectAndJoin(member.cookie, archivedRoom.id);

    const archiveOwnerRevoked = waitForEvent(
      archiveOwnerJoin.socket,
      'room:access_revoked',
    );
    const archiveMemberRevoked = waitForEvent(
      archiveMemberJoin.socket,
      'room:access_revoked',
    );

    const archived = await owner.agent
      .patch(`/api/v1/rooms/${archivedRoom.id}`)
      .set('x-csrf-token', owner.csrfToken)
      .send({ status: 'archived' });

    expect(archived.status).toBe(200);
    await expect(archiveOwnerRevoked).resolves.toEqual({
      roomId: archivedRoom.id,
      reason: 'ROOM_ARCHIVED',
    });
    await expect(archiveMemberRevoked).resolves.toEqual({
      roomId: archivedRoom.id,
      reason: 'ROOM_ARCHIVED',
    });
    expect(realtime.getOnlineMembers(archivedRoom.id)).toEqual([]);

    expect(
      await emitRoomAction(archiveMemberJoin.socket, 'room:join', { roomId: archivedRoom.id }),
    ).toEqual({
      ok: false,
      error: {
        code: 'ROOM_ARCHIVED',
        message: 'This room is archived and not accepting new members',
      },
    });

    const reactivated = await owner.agent
      .patch(`/api/v1/rooms/${archivedRoom.id}`)
      .set('x-csrf-token', owner.csrfToken)
      .send({ status: 'active' });

    expect(reactivated.status).toBe(200);

    const reactivatedSnapshot = waitForEvent(
      archiveMemberJoin.socket,
      'presence:snapshot',
    );
    expect(
      await emitRoomAction(archiveMemberJoin.socket, 'room:join', {
        roomId: archivedRoom.id,
      }),
    ).toEqual({ ok: true });
    expect((await reactivatedSnapshot).onlineMembers.map((entry) => entry.userId)).toEqual([
      member.user.id,
    ]);
  });

  it('disconnects active sockets when the session is logged out or expires', async () => {
    const owner = await register('realtime-session-owner', 'Session Owner');
    const expiredOwner = await register('realtime-session-expired', 'Expired Owner');
    const room = await createRoom(owner, 'Session Room');
    const expiredRoom = await createRoom(expiredOwner, 'Expired Room');

    const ownerJoin = await connectAndJoin(owner.cookie, room.id);
    const disconnected = new Promise<void>((resolve) => {
      ownerJoin.socket.once('disconnect', () => resolve());
    });
    const revoked = waitForEvent(
      ownerJoin.socket,
      'room:access_revoked',
    );

    const logout = await owner.agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', owner.csrfToken);

    expect(logout.status).toBe(204);
    await expect(revoked).resolves.toEqual({ roomId: room.id, reason: 'SESSION_ENDED' });
    await disconnected;
    await waitForCondition(() => realtime.getOnlineMembers(room.id).length === 0);

    const expiredJoin = await connectAndJoin(expiredOwner.cookie, expiredRoom.id);
    const expiredRevoked = waitForEvent(
      expiredJoin.socket,
      'room:access_revoked',
    );
    const database = mongoose.connection.db;

    if (!database) {
      throw new Error('Test database is not connected');
    }

    await database.collection('sessions').deleteMany({});
    await realtime.revalidateSessions();

    await expect(expiredRevoked).resolves.toEqual({
      roomId: expiredRoom.id,
      reason: 'SESSION_ENDED',
    });
    await waitForCondition(() => realtime.getOnlineMembers(expiredRoom.id).length === 0);
  });
});

describe('room isolation', () => {
  it('keeps presence isolated between rooms and users', async () => {
    const owner = await register('realtime-isolation-owner', 'Isolation Owner');
    const member = await register('realtime-isolation-member', 'Isolation Member');
    const firstRoom = await createRoom(owner, 'First Isolation Room');
    const secondRoom = await createRoom(owner, 'Second Isolation Room');
    await joinRoomViaRest(member, firstRoom.inviteCode);
    await joinRoomViaRest(member, secondRoom.inviteCode);

    const firstOwnerSocket = await connectAndJoin(owner.cookie, firstRoom.id);
    await connectAndJoin(owner.cookie, secondRoom.id);

    const joinedPromise = waitForEvent(
      firstOwnerSocket.socket,
      'presence:member_joined',
    );
    const memberJoin = await connectAndJoin(member.cookie, firstRoom.id);

    await expect(joinedPromise).resolves.toEqual({
      roomId: firstRoom.id,
      member: { userId: member.user.id, displayName: 'Isolation Member' },
    });

    expect(realtime.getOnlineMembers(firstRoom.id)).toEqual([
      { userId: member.user.id, displayName: 'Isolation Member' },
      { userId: owner.user.id, displayName: 'Isolation Owner' },
    ]);
    expect(realtime.getOnlineMembers(secondRoom.id)).toEqual([
      { userId: owner.user.id, displayName: 'Isolation Owner' },
    ]);
    expect(memberJoin.snapshot.onlineMembers.map((entry) => entry.userId)).toEqual([
      member.user.id,
      owner.user.id,
    ]);
  });
});

describe('collaborative documents', () => {
  it('syncs edits between subscribed room members and isolates documents by room', async () => {
    const owner = await register('doc-sync-owner', 'Doc Owner');
    const member = await register('doc-sync-member', 'Doc Member');
    const room = await createRoom(owner, 'Sync Room');
    const otherRoom = await createRoom(owner, 'Other Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerSocket = await connectSocket(owner.cookie);
    const memberSocket = await connectSocket(member.cookie);
    const otherSocket = await connectSocket(owner.cookie);
    const documentsBefore = realtime.getDocumentCount();

    expect(await subscribeDocument(ownerSocket, room.id)).toEqual({ ok: true });
    expect(await subscribeDocument(memberSocket, room.id)).toEqual({ ok: true });
    expect(realtime.getDocumentCount()).toBe(documentsBefore + 1);
    expect(realtime.getDocumentSubscriptionCount()).toBe(2);

    const ownerDoc = new Doc();
    const memberDoc = new Doc();
    ownerDoc.getText('content').insert(0, 'const shared = 1;\n');

    const memberUpdate = waitForEvent(memberSocket, 'document:message');
    expect(
      await sendDocumentMessage(ownerSocket, room.id, encodeDocumentUpdate(ownerDoc)),
    ).toEqual({ ok: true });

    applyServerDocumentMessage(memberDoc, (await memberUpdate).message);
    expect(memberDoc.getText('content').toString()).toBe('const shared = 1;\n');

    memberDoc.getText('content').insert(memberDoc.getText('content').length, '// member edit\n');

    const ownerUpdate = waitForEvent(ownerSocket, 'document:message');
    expect(
      await sendDocumentMessage(memberSocket, room.id, encodeDocumentUpdate(memberDoc)),
    ).toEqual({ ok: true });

    applyServerDocumentMessage(ownerDoc, (await ownerUpdate).message);
    expect(ownerDoc.getText('content').toString()).toBe(
      'const shared = 1;\n// member edit\n',
    );

    const otherDoc = new Doc();
    expect(await subscribeDocument(otherSocket, otherRoom.id)).toEqual({ ok: true });
    const otherMessages = collectDocumentMessages(otherSocket, 2);
    expect(
      await sendDocumentMessage(otherSocket, otherRoom.id, encodeSyncStep1(otherDoc)),
    ).toEqual({ ok: true });
    applyServerDocumentMessage(otherDoc, (await otherMessages)[0]!.message);
    expect(otherDoc.getText('content').toString()).toBe('');
    expect(realtime.getDocumentCount()).toBe(documentsBefore + 2);
  });

  it('resynchronizes a new subscriber from server state without duplicating content', async () => {
    const owner = await register('doc-resync-owner', 'Resync Owner');
    const member = await register('doc-resync-member', 'Resync Member');
    const outsider = await register('doc-resync-outsider', 'Resync Outsider');
    const room = await createRoom(owner, 'Resync Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(ownerSocket, room.id)).toEqual({ ok: true });

    const ownerDoc = new Doc();
    ownerDoc.getText('content').insert(0, 'let answer = 42;\n');

    expect(
      await sendDocumentMessage(ownerSocket, room.id, encodeDocumentUpdate(ownerDoc)),
    ).toEqual({ ok: true });

    const lateSocket = await connectSocket(member.cookie);
    expect(await subscribeDocument(lateSocket, room.id)).toEqual({ ok: true });
    const lateDoc = new Doc();
    const lateMessages = collectDocumentMessages(lateSocket, 2);

    expect(
      await sendDocumentMessage(lateSocket, room.id, encodeSyncStep1(lateDoc)),
    ).toEqual({ ok: true });

    const syncReplies = await lateMessages;
    applyServerDocumentMessage(lateDoc, syncReplies[0]!.message);
    expect(lateDoc.getText('content').toString()).toBe('let answer = 42;\n');

    const syncedText = lateDoc.getText('content').toString();
    expect(
      await sendDocumentMessage(lateSocket, room.id, encodeDocumentUpdate(lateDoc)),
    ).toEqual({ ok: true });

    const verifierSocket = await connectSocket(member.cookie);
    expect(await subscribeDocument(verifierSocket, room.id)).toEqual({ ok: true });
    const verifierDoc = new Doc();
    const verifierMessages = collectDocumentMessages(verifierSocket, 2);
    expect(
      await sendDocumentMessage(verifierSocket, room.id, encodeSyncStep1(verifierDoc)),
    ).toEqual({ ok: true });
    applyServerDocumentMessage(verifierDoc, (await verifierMessages)[0]!.message);
    expect(verifierDoc.getText('content').toString()).toBe(syncedText);

    const outsiderSocket = await connectSocket(outsider.cookie);
    expect(await subscribeDocument(outsiderSocket, room.id)).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Room not found' },
    });
  });

  it('revalidates room membership before processing each document message', async () => {
    const owner = await register('doc-revalidate-owner', 'Revalidate Owner');
    const member = await register('doc-revalidate-member', 'Revalidate Member');
    const room = await createRoom(owner, 'Revalidate Room');
    await joinRoomViaRest(member, room.inviteCode);

    const memberSocket = await connectSocket(member.cookie);
    expect(await subscribeDocument(memberSocket, room.id)).toEqual({ ok: true });
    const subscriptionsBefore = realtime.getDocumentSubscriptionCount();
    const doc = new Doc();
    doc.getText('content').insert(0, 'before removal');

    expect(
      await sendDocumentMessage(memberSocket, room.id, encodeDocumentUpdate(doc)),
    ).toEqual({ ok: true });

    await Room.updateOne(
      { _id: room.id },
      { $pull: { members: { user: new Types.ObjectId(member.user.id) } } },
    );

    const revoked = waitForEvent(memberSocket, 'room:access_revoked');
    const nextDoc = new Doc();
    nextDoc.getText('content').insert(0, 'after removal');
    const result = await sendDocumentMessage(
      memberSocket,
      room.id,
      encodeDocumentUpdate(nextDoc),
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Room not found' },
    });
    await expect(revoked).resolves.toEqual({
      roomId: room.id,
      reason: 'MEMBERSHIP_REVOKED',
    });
    expect(realtime.getDocumentSubscriptionCount()).toBe(subscriptionsBefore - 1);

    expect(
      await sendDocumentMessage(memberSocket, room.id, encodeDocumentUpdate(nextDoc)),
    ).toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_NOT_SUBSCRIBED',
        message: 'Document subscription is not active',
      },
    });
  });

  it('revokes document access on leave and retains archived state until reactivation', async () => {
    const owner = await register('doc-hooks-owner', 'Hooks Owner');
    const member = await register('doc-hooks-member', 'Hooks Member');
    const room = await createRoom(owner, 'Hooks Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerSocket = await connectSocket(owner.cookie);
    const memberSocket = await connectSocket(member.cookie);
    expect(await subscribeDocument(ownerSocket, room.id)).toEqual({ ok: true });
    expect(await subscribeDocument(memberSocket, room.id)).toEqual({ ok: true });
    const subscriptionsBefore = realtime.getDocumentSubscriptionCount();
    const documentsBefore = realtime.getDocumentCount();

    const ownerDoc = new Doc();
    ownerDoc.getText('content').insert(0, 'survives archive');
    expect(
      await sendDocumentMessage(ownerSocket, room.id, encodeDocumentUpdate(ownerDoc)),
    ).toEqual({ ok: true });

    const ownerRevoked = waitForEvent(ownerSocket, 'room:access_revoked');
    const memberRevoked = waitForEvent(memberSocket, 'room:access_revoked');
    const archived = await owner.agent
      .patch(`/api/v1/rooms/${room.id}`)
      .set('x-csrf-token', owner.csrfToken)
      .send({ status: 'archived' });

    expect(archived.status).toBe(200);
    await expect(ownerRevoked).resolves.toEqual({
      roomId: room.id,
      reason: 'ROOM_ARCHIVED',
    });
    await expect(memberRevoked).resolves.toEqual({
      roomId: room.id,
      reason: 'ROOM_ARCHIVED',
    });
    expect(realtime.getDocumentSubscriptionCount()).toBe(subscriptionsBefore - 2);
    expect(realtime.getDocumentCount()).toBe(documentsBefore);

    const reactivated = await owner.agent
      .patch(`/api/v1/rooms/${room.id}`)
      .set('x-csrf-token', owner.csrfToken)
      .send({ status: 'active' });
    expect(reactivated.status).toBe(200);
    expect(await subscribeDocument(ownerSocket, room.id)).toEqual({ ok: true });

    const restoredDoc = new Doc();
    const restoredMessages = collectDocumentMessages(ownerSocket, 2);
    expect(
      await sendDocumentMessage(ownerSocket, room.id, encodeSyncStep1(restoredDoc)),
    ).toEqual({ ok: true });
    applyServerDocumentMessage(restoredDoc, (await restoredMessages)[0]!.message);
    expect(restoredDoc.getText('content').toString()).toBe('survives archive');

    expect(await subscribeDocument(memberSocket, room.id)).toEqual({ ok: true });
    const leaveRevoked = waitForEvent(memberSocket, 'room:access_revoked');
    const left = await member.agent
      .post(`/api/v1/rooms/${room.id}/leave`)
      .set('x-csrf-token', member.csrfToken);

    expect(left.status).toBe(204);
    await expect(leaveRevoked).resolves.toEqual({
      roomId: room.id,
      reason: 'MEMBERSHIP_REVOKED',
    });
  });

  it('deletes document state when a room is deleted and disconnects docs on logout', async () => {
    const owner = await register('doc-delete-owner', 'Delete Doc Owner');
    const room = await createRoom(owner, 'Delete Doc Room');
    const socket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(socket, room.id)).toEqual({ ok: true });
    const docsBefore = realtime.getDocumentCount();

    const doc = new Doc();
    doc.getText('content').insert(0, 'temporary');
    expect(await sendDocumentMessage(socket, room.id, encodeDocumentUpdate(doc))).toEqual({
      ok: true,
    });

    const deletedRevoked = waitForEvent(socket, 'room:access_revoked');
    const deleted = await owner.agent
      .delete(`/api/v1/rooms/${room.id}`)
      .set('x-csrf-token', owner.csrfToken);

    expect(deleted.status).toBe(204);
    await expect(deletedRevoked).resolves.toEqual({
      roomId: room.id,
      reason: 'ROOM_DELETED',
    });
    expect(realtime.getDocumentCount()).toBe(docsBefore - 1);

    const logoutRoom = await createRoom(owner, 'Logout Doc Room');
    const logoutSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(logoutSocket, logoutRoom.id)).toEqual({ ok: true });
    const disconnected = new Promise<void>((resolve) => {
      logoutSocket.once('disconnect', () => resolve());
    });
    const logoutRevoked = waitForEvent(logoutSocket, 'room:access_revoked');
    const logout = await owner.agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', owner.csrfToken);

    expect(logout.status).toBe(204);
    await expect(logoutRevoked).resolves.toEqual({
      roomId: logoutRoom.id,
      reason: 'SESSION_ENDED',
    });
    await disconnected;
  });

  it('rejects invalid payloads, malformed updates, oversized messages, and rate abuse', async () => {
    const owner = await register('doc-validation-owner');
    const room = await createRoom(owner, 'Validation Doc Room');
    const socket = await connectSocket(owner.cookie);

    expect(
      await emitDocumentAction(socket, 'document:message', {
        roomId: room.id,
        documentId: 'main',
        message: new Uint8Array([0]),
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_NOT_SUBSCRIBED',
        message: 'Document subscription is not active',
      },
    });

    expect(await subscribeDocument(socket, room.id)).toEqual({ ok: true });

    expect(
      await emitDocumentAction(socket, 'document:subscribe', {
        roomId: room.id,
        documentId: 'other',
      }),
    ).toEqual({
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid document payload' },
    });

    const malformed = new Uint8Array([255]);
    const malformedResult = await sendDocumentMessage(socket, room.id, malformed);
    expect(malformedResult).toEqual({
      ok: false,
      error: { code: 'DOCUMENT_INVALID_MESSAGE', message: 'Invalid Yjs message' },
    });

    const oversizedSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(oversizedSocket, room.id)).toEqual({ ok: true });
    const oversized = new Uint8Array(256 * 1024 + 1);
    const oversizedResult = await sendDocumentMessage(oversizedSocket, room.id, oversized);
    expect(oversizedResult).toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_TOO_LARGE',
        message: 'Document message exceeds the allowed size',
      },
    });

    const largeStateSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(largeStateSocket, room.id)).toEqual({ ok: true });
    const largeDoc = new Doc();
    largeDoc.getText('content').insert(0, 'a'.repeat(200 * 1024));
    const largeStateResult = await sendDocumentMessage(
      largeStateSocket,
      room.id,
      encodeDocumentUpdate(largeDoc),
    );
    expect(largeStateResult).toEqual({
      ok: false,
      error: { code: 'DOCUMENT_TOO_LARGE', message: 'Document exceeds the allowed size' },
    });

    const rateSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(rateSocket, room.id)).toEqual({ ok: true });
    const noOp = encodeDocumentUpdate(new Doc());
    let rateResult: RoomActionResult | null = null;

    for (let attempt = 0; attempt < 201; attempt += 1) {
      rateResult = await sendDocumentMessage(rateSocket, room.id, noOp);
    }

    expect(rateResult).toEqual({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many document updates. Reconnect to resynchronize.',
      },
    });
  }, 10_000);
});

describe('document hub limits', () => {
  it('enforces the per-socket message and byte window', () => {
    const hub = new DocumentHub({} as never);

    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(hub.consumeRate('rate-socket', 1)).toBe(true);
    }

    expect(hub.consumeRate('rate-socket', 1)).toBe(false);

    const byteHub = new DocumentHub({} as never);
    expect(byteHub.consumeRate('byte-socket', 2 * 1024 * 1024)).toBe(true);
    expect(byteHub.consumeRate('byte-socket', 1)).toBe(false);
  });
});
