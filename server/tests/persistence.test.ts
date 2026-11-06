import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import { createApp } from '../src/app.js';
import { closeSessionStore } from '../src/config/session.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connect.js';
import { Project } from '../src/models/Project.js';
import { LearningPath } from '../src/models/LearningPath.js';
import { CollaborativeDocument } from '../src/models/CollaborativeDocument.js';
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

  realtime.resetDocuments();
});

afterEach(() => {
  for (const socket of openSockets.splice(0)) {
    socket.disconnect();
  }
});

afterAll(async () => {
  await closeRealtime();

  if (httpServer && httpServer.listening) {
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

  it('shares document initialization across concurrent subscribers', async () => {
    const owner = await register('share-owner', 'Share Owner');
    const room = await createRoom(owner, 'Share Room');

    const sockets: RoomSocket[] = [];
    const subscribePromises: Promise<RoomActionResult>[] = [];

    for (let i = 0; i < 3; i += 1) {
      sockets.push(await connectSocket(owner.cookie));
      subscribePromises.push(subscribeDocument(sockets[i]!, room.id));
    }

    const results = await Promise.all(subscribePromises);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(realtime.getDocumentCount()).toBe(1);
    expect(realtime.getDocumentSubscriptionCount()).toBe(3);
  });

  it('restores document state from server on fresh subscribe', async () => {
    const owner = await register('persistence-owner', 'Persistence Owner');
    const member = await register('persistence-member', 'Persistence Member');
    const room = await createRoom(owner, 'Persistence Room');
    await joinRoomViaRest(member, room.inviteCode);

    const ownerSocket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(ownerSocket, room.id)).toEqual({ ok: true });

    const ownerDoc = new Doc();
    ownerDoc.getText('content').insert(0, 'const shared = 1;\n');

    expect(
      await sendDocumentMessage(ownerSocket, room.id, encodeDocumentUpdate(ownerDoc)),
    ).toEqual({ ok: true });

    // New subscriber subscribes immediately and collects messages before sending sync step 1
    const newSocket = await connectSocket(member.cookie);
    expect(await subscribeDocument(newSocket, room.id)).toEqual({ ok: true });

    const newDoc = new Doc();
    const lateMessages = collectDocumentMessages(newSocket, 2);

    expect(
      await sendDocumentMessage(newSocket, room.id, encodeSyncStep1(newDoc)),
    ).toEqual({ ok: true });

    const syncReplies = await lateMessages;
    applyServerDocumentMessage(newDoc, syncReplies[0]!.message);
    expect(newDoc.getText('content').toString()).toBe('const shared = 1;\n');
  });

  it('deletes document state when a room is deleted and disconnects docs on logout', async () => {
    const owner = await register('doc-delete-owner', 'Delete Doc Owner');
    const room = await createRoom(owner, 'Delete Doc Room');
    const socket = await connectSocket(owner.cookie);
    expect(await subscribeDocument(socket, room.id)).toEqual({ ok: true });
    const docsBefore = realtime.getDocumentCount();

    const doc = new Doc();
    doc.getText('content').insert(0, 'temporary\n');

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
  });
});