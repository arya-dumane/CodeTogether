import type { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { Types } from 'mongoose';
import type { SessionData } from 'express-session';
import { Server } from 'socket.io';
import { corsOptions, isAllowedOrigin } from '../config/cors.js';
import { sessionMiddleware, sessionStore } from '../config/session.js';
import { AppError } from '../errors/AppError.js';
import {
  getRoomPresenceAccess,
  requireActiveRoomMembership,
} from '../services/room.service.js';
import {
  DocumentHub,
  DocumentMessageError,
  MAX_DOCUMENT_MESSAGE_BYTES,
} from './documents.js';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  documentMessageSchema,
  documentTargetSchema,
  roomTargetSchema,
  type AccessRevokedReason,
  type ClientToServerEvents,
  type DocumentMessage,
  type InterServerEvents,
  type OnlineRoomMember,
  type PresenceMemberEvent,
  type PresenceSnapshot,
  type RealtimeError,
  type RoomActionResult,
  type RoomSocket,
  type ServerToClientEvents,
  type SocketData,
} from './events.js';

const ROOM_ACTION_LIMIT = 20;
const ROOM_ACTION_WINDOW_MS = 10_000;
const DEFAULT_SESSION_REVALIDATION_MS = 30_000;
const SOCKET_MAX_BUFFER_BYTES = MAX_DOCUMENT_MESSAGE_BYTES + 16 * 1024;

type SessionRequest = IncomingMessage & {
  session?: SessionData;
  sessionID?: string;
};

interface PresenceUser {
  userId: string;
  displayName: string;
  connections: Set<string>;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

export interface RealtimeServerOptions {
  sessionRevalidationIntervalMs?: number;
}

function loadSession(sessionId: string): Promise<SessionData | null> {
  return new Promise((resolve, reject) => {
    sessionStore.get(sessionId, (error, session) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(session ?? null);
    });
  });
}

function authenticationError(): Error & { data: { code: string } } {
  const error = new Error('Authentication required') as Error & { data: { code: string } };
  error.data = { code: 'UNAUTHENTICATED' };
  return error;
}

function mapAppError(error: AppError): RealtimeError {
  if (error.code === 'ROOM_ARCHIVED') {
    return { code: 'ROOM_ARCHIVED', message: error.message };
  }

  if (error.code === 'UNAUTHENTICATED') {
    return { code: 'UNAUTHENTICATED', message: error.message };
  }

  if (error.code === 'INTERNAL_ERROR') {
    return { code: 'INTERNAL_ERROR', message: error.message };
  }

  return { code: 'NOT_FOUND', message: error.message };
}

export class RealtimeServer {
  readonly io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;

  private readonly presence = new Map<string, Map<string, PresenceUser>>();
  private readonly sessions = new Map<string, Set<string>>();
  private readonly rateWindows = new Map<string, RateWindow>();
  private readonly documents: DocumentHub;
  private readonly revalidationIntervalMs: number;
  private revalidationTimer: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer, options: RealtimeServerOptions = {}) {
    this.revalidationIntervalMs =
      options.sessionRevalidationIntervalMs ?? DEFAULT_SESSION_REVALIDATION_MS;

    this.io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(httpServer, {
      serveClient: false,
      cors: corsOptions,
      allowRequest: (request, callback) => {
        callback(null, isAllowedOrigin(request.headers.origin));
      },
      maxHttpBufferSize: SOCKET_MAX_BUFFER_BYTES,
    });

    this.documents = new DocumentHub(this.io);
    this.io.engine.use(sessionMiddleware);

    this.io.use((socket, next) => {
      const request = socket.request as SessionRequest;
      const userId = request.session?.userId;
      const sessionId = request.sessionID;

      if (!userId || !sessionId || !Types.ObjectId.isValid(userId)) {
        next(authenticationError());
        return;
      }

      socket.data.userId = userId;
      socket.data.sessionId = sessionId;
      socket.data.rooms = new Set();
      socket.data.documents = new Set();
      next();
    });

    this.io.on('connection', (socket) => this.handleConnection(socket));

    if (this.revalidationIntervalMs > 0) {
      this.revalidationTimer = setInterval(() => {
        void this.revalidateSessions();
        void this.revalidateDocuments();
      }, this.revalidationIntervalMs);
      this.revalidationTimer.unref();
    }
  }

  getOnlineMembers(roomId: string): OnlineRoomMember[] {
    const users = this.presence.get(roomId);

    if (!users) {
      return [];
    }

    return [...users.values()]
      .map((user) => ({ userId: user.userId, displayName: user.displayName }))
      .sort(
        (first, second) =>
          first.displayName.localeCompare(second.displayName) ||
          first.userId.localeCompare(second.userId),
      );
  }

  getDocumentCount(): number {
    return this.documents.documentCount;
  }

  getDocumentSubscriptionCount(): number {
    return this.documents.subscriptionCount;
  }

  revokeUserFromRoom(userId: string, roomId: string, reason: AccessRevokedReason): void {
    const roomPresence = this.presence.get(roomId);
    const presenceUser = roomPresence?.get(userId);

    if (roomPresence && presenceUser) {
      roomPresence.delete(userId);

      if (roomPresence.size === 0) {
        this.presence.delete(roomId);
      }

      for (const socketId of presenceUser.connections) {
        const socket = this.io.sockets.sockets.get(socketId);

        if (!socket) {
          continue;
        }

        socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
        socket.data.rooms.delete(roomId);
        socket.leave(roomId);
      }

      this.io.to(roomId).emit(SERVER_EVENTS.presenceMemberLeft, {
        roomId,
        member: { userId, displayName: presenceUser.displayName },
      });
    }

    this.documents.revokeUserFromRoom(userId, roomId, reason);
  }

  closeRoom(roomId: string, reason: AccessRevokedReason): void {
    const socketIds = this.io.sockets.adapter.rooms.get(roomId);
    this.documents.closeRoom(roomId, reason);

    if (!socketIds) {
      this.presence.delete(roomId);
      return;
    }

    for (const socketId of [...socketIds]) {
      const socket = this.io.sockets.sockets.get(socketId);

      if (!socket) {
        continue;
      }

      socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
      socket.data.rooms.delete(roomId);
      socket.leave(roomId);
    }

    this.presence.delete(roomId);
  }

  disconnectSession(sessionId: string, reason: AccessRevokedReason = 'SESSION_ENDED'): void {
    const socketIds = this.sessions.get(sessionId);

    if (!socketIds) {
      return;
    }

    for (const socketId of [...socketIds]) {
      const socket = this.io.sockets.sockets.get(socketId);

      if (!socket) {
        continue;
      }

      for (const roomId of [...socket.data.rooms]) {
        socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
        this.detachSocketFromRoom(socket, roomId);
      }

      this.documents.revokeSocket(socket as RoomSocket, reason);
      socket.disconnect(true);
    }

    this.sessions.delete(sessionId);
  }

  async revalidateSessions(): Promise<void> {
    const sessionEntries = [...this.sessions.entries()];

    await Promise.all(
      sessionEntries.map(async ([sessionId, socketIds]) => {
        const firstSocketId = socketIds.values().next().value as string | undefined;

        if (!firstSocketId) {
          return;
        }

        const socket = this.io.sockets.sockets.get(firstSocketId);

        if (!socket) {
          return;
        }

        let session: SessionData | null;

        try {
          session = await loadSession(sessionId);
        } catch {
          return;
        }

        if (!session?.userId || session.userId !== socket.data.userId) {
          this.disconnectSession(sessionId, 'SESSION_ENDED');
        }
      }),
    );
  }

  async revalidateDocuments(): Promise<void> {
    const subscriptions = this.documents.listSubscriptions();
    const pairs = new Map<string, { userId: string; roomId: string }>();

    for (const subscription of subscriptions) {
      if (!this.io.sockets.sockets.has(subscription.socketId)) {
        continue;
      }

      pairs.set(`${subscription.userId}:${subscription.roomId}`, {
        userId: subscription.userId,
        roomId: subscription.roomId,
      });
    }

    await Promise.all(
      [...pairs.values()].map(async ({ userId, roomId }) => {
        try {
          await requireActiveRoomMembership(userId, roomId);
        } catch (error) {
          if (!(error instanceof AppError)) {
            return;
          }

          if (error.code === 'ROOM_ARCHIVED') {
            this.revokeUserFromRoom(userId, roomId, 'ROOM_ARCHIVED');
            return;
          }

          if (error.code === 'NOT_FOUND') {
            this.revokeUserFromRoom(userId, roomId, 'MEMBERSHIP_REVOKED');
          }
        }
      }),
    );
  }

  async close(): Promise<void> {
    if (this.revalidationTimer) {
      clearInterval(this.revalidationTimer);
      this.revalidationTimer = null;
    }

    this.rateWindows.clear();
    this.documents.close();

    await new Promise<void>((resolve) => {
      this.io.close(() => resolve());
    });

    this.presence.clear();
    this.sessions.clear();
  }

  private handleConnection(socket: RoomSocket): void {
    const sessionSockets = this.sessions.get(socket.data.sessionId) ?? new Set<string>();
    sessionSockets.add(socket.id);
    this.sessions.set(socket.data.sessionId, sessionSockets);

    socket.on(CLIENT_EVENTS.roomJoin, (payload, acknowledge) => {
      void this.handleRoomJoin(socket, payload, acknowledge);
    });

    socket.on(CLIENT_EVENTS.roomLeave, (payload, acknowledge) => {
      this.handleRoomLeave(socket, payload, acknowledge);
    });

    socket.on(CLIENT_EVENTS.documentSubscribe, (payload, acknowledge) => {
      void this.handleDocumentSubscribe(socket, payload, acknowledge);
    });

    socket.on(CLIENT_EVENTS.documentUnsubscribe, (payload, acknowledge) => {
      this.handleDocumentUnsubscribe(socket, payload, acknowledge);
    });

    socket.on(CLIENT_EVENTS.documentMessage, (payload, acknowledge) => {
      void this.handleDocumentMessage(socket, payload, acknowledge);
    });

    socket.onAny((event, ...args) => {
      if (
        event === CLIENT_EVENTS.roomJoin ||
        event === CLIENT_EVENTS.roomLeave ||
        event === CLIENT_EVENTS.documentSubscribe ||
        event === CLIENT_EVENTS.documentUnsubscribe ||
        event === CLIENT_EVENTS.documentMessage
      ) {
        return;
      }

      const acknowledge = args[args.length - 1];
      const result: RoomActionResult = {
        ok: false,
        error: { code: 'UNSUPPORTED_EVENT', message: 'Unsupported event' },
      };

      if (typeof acknowledge === 'function') {
        acknowledge(result);
        return;
      }

      socket.emit(SERVER_EVENTS.presenceError, result.error);
    });

    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  private async handleRoomJoin(
    socket: RoomSocket,
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ): Promise<void> {
    if (!this.consumeRoomAction(socket, acknowledge)) {
      return;
    }

    const parsed = roomTargetSchema.safeParse(payload);

    if (!parsed.success) {
      this.reply(socket, acknowledge, {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid room payload' },
      });
      return;
    }

    const { roomId } = parsed.data;

    try {
      let session: SessionData | null;

      try {
        session = await loadSession(socket.data.sessionId);
      } catch {
        this.reply(socket, acknowledge, {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Presence service unavailable' },
        });
        return;
      }

      if (!session?.userId || session.userId !== socket.data.userId) {
        this.reply(socket, acknowledge, {
          ok: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
        });
        socket.disconnect(true);
        return;
      }

      const access = await getRoomPresenceAccess(socket.data.userId, roomId);

      if (socket.data.rooms.has(roomId)) {
        this.emitSnapshot(socket, roomId);
        this.reply(socket, acknowledge, { ok: true });
        return;
      }

      socket.join(roomId);
      socket.data.rooms.add(roomId);

      const becameVisible = this.addPresence(
        roomId,
        socket.data.userId,
        access.displayName,
        socket.id,
      );

      try {
        await getRoomPresenceAccess(socket.data.userId, roomId);
      } catch (error) {
        this.detachSocketFromRoom(socket, roomId, false);

        if (error instanceof AppError) {
          this.reply(socket, acknowledge, { ok: false, error: mapAppError(error) });
          return;
        }

        this.reply(socket, acknowledge, {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Presence service unavailable' },
        });
        return;
      }

      this.emitSnapshot(socket, roomId);

      if (becameVisible) {
        const event: PresenceMemberEvent = {
          roomId,
          member: { userId: socket.data.userId, displayName: access.displayName },
        };
        socket.to(roomId).emit(SERVER_EVENTS.presenceMemberJoined, event);
      }

      this.reply(socket, acknowledge, { ok: true });
    } catch (error) {
      if (error instanceof AppError) {
        this.reply(socket, acknowledge, { ok: false, error: mapAppError(error) });
        return;
      }

      this.reply(socket, acknowledge, {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Presence service unavailable' },
      });
    }
  }

  private handleRoomLeave(
    socket: RoomSocket,
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ): void {
    if (!this.consumeRoomAction(socket, acknowledge)) {
      return;
    }

    const parsed = roomTargetSchema.safeParse(payload);

    if (!parsed.success) {
      this.reply(socket, acknowledge, {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid room payload' },
      });
      return;
    }

    this.detachSocketFromRoom(socket, parsed.data.roomId);
    this.reply(socket, acknowledge, { ok: true });
  }

  private async handleDocumentSubscribe(
    socket: RoomSocket,
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ): Promise<void> {
    if (!this.consumeRoomAction(socket, acknowledge)) {
      return;
    }

    const parsed = documentTargetSchema.safeParse(payload);

    if (!parsed.success) {
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid document payload' },
      });
      return;
    }

    const { roomId, documentId } = parsed.data;

    try {
      const session = await this.loadSessionForSocket(socket);

      if (!session) {
        this.replyDocument(socket, acknowledge, {
          ok: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
        });
        socket.disconnect(true);
        return;
      }

      await requireActiveRoomMembership(socket.data.userId, roomId);
      this.documents.subscribe(socket, roomId, documentId);
      this.replyDocument(socket, acknowledge, { ok: true });
    } catch (error) {
      if (error instanceof AppError) {
        this.replyDocument(socket, acknowledge, { ok: false, error: mapAppError(error) });
        return;
      }

      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Document service unavailable' },
      });
    }
  }

  private handleDocumentUnsubscribe(
    socket: RoomSocket,
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ): void {
    if (!this.consumeRoomAction(socket, acknowledge)) {
      return;
    }

    const parsed = documentTargetSchema.safeParse(payload);

    if (!parsed.success) {
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid document payload' },
      });
      return;
    }

    this.documents.unsubscribe(socket, parsed.data.roomId, parsed.data.documentId);
    this.replyDocument(socket, acknowledge, { ok: true });
  }

  private async handleDocumentMessage(
    socket: RoomSocket,
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ): Promise<void> {
    const parsed = documentMessageSchema.safeParse(payload);

    if (!parsed.success) {
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid document message' },
      });
      return;
    }

    const { roomId, documentId, message } = parsed.data;

    if (message.byteLength === 0 || message.byteLength > MAX_DOCUMENT_MESSAGE_BYTES) {
      this.rejectDocumentTraffic(socket, acknowledge, {
        code: 'DOCUMENT_TOO_LARGE',
        message: 'Document message exceeds the allowed size',
      });
      return;
    }

    if (!this.documents.consumeRate(socket.id, message.byteLength)) {
      this.rejectDocumentTraffic(socket, acknowledge, {
        code: 'RATE_LIMITED',
        message: 'Too many document updates. Reconnect to resynchronize.',
      });
      return;
    }

    if (!this.documents.hasSubscription(socket, roomId, documentId)) {
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: {
          code: 'DOCUMENT_NOT_SUBSCRIBED',
          message: 'Document subscription is not active',
        },
      });
      return;
    }

    const session = await this.loadSessionForSocket(socket);

    if (!session?.userId || session.userId !== socket.data.userId) {
      this.documents.revokeSocket(socket, 'SESSION_ENDED');
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      socket.disconnect(true);
      return;
    }

    try {
      await requireActiveRoomMembership(socket.data.userId, roomId);
    } catch (error) {
      if (!(error instanceof AppError)) {
        this.replyDocument(socket, acknowledge, {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Document service unavailable' },
        });
        return;
      }

      this.documents.revokeUserFromRoom(
        socket.data.userId,
        roomId,
        error.code === 'ROOM_ARCHIVED' ? 'ROOM_ARCHIVED' : 'MEMBERSHIP_REVOKED',
      );
      this.replyDocument(socket, acknowledge, { ok: false, error: mapAppError(error) });
      return;
    }

    const document = this.documents.getDocument(roomId, documentId);

    if (!document) {
      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: {
          code: 'DOCUMENT_NOT_SUBSCRIBED',
          message: 'Document subscription is not active',
        },
      });
      return;
    }

    try {
      const replies = this.documents.handleMessage(socket, document, message);

      for (const reply of replies) {
        const response: DocumentMessage = { roomId, documentId, message: reply };
        socket.emit(SERVER_EVENTS.documentMessage, response);
      }

      this.replyDocument(socket, acknowledge, { ok: true });
    } catch (error) {
      if (error instanceof DocumentMessageError) {
        this.rejectDocumentTraffic(socket, acknowledge, {
          code: error.code,
          message: error.message,
        });
        return;
      }

      this.replyDocument(socket, acknowledge, {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Document service unavailable' },
      });
    }
  }

  private async loadSessionForSocket(socket: RoomSocket): Promise<SessionData | null> {
    try {
      const session = await loadSession(socket.data.sessionId);
      return session?.userId === socket.data.userId ? session : null;
    } catch {
      return null;
    }
  }

  private rejectDocumentTraffic(
    socket: RoomSocket,
    acknowledge: ((result: RoomActionResult) => void) | undefined,
    error: RealtimeError,
  ): void {
    this.replyDocument(socket, acknowledge, { ok: false, error });
    socket.disconnect(true);
  }

  private replyDocument(
    socket: RoomSocket,
    acknowledge: ((result: RoomActionResult) => void) | undefined,
    result: RoomActionResult,
  ): void {
    if (typeof acknowledge === 'function') {
      acknowledge(result);
      return;
    }

    if (!result.ok) {
      socket.emit(SERVER_EVENTS.documentError, result.error);
    }
  }

  private handleDisconnect(socket: RoomSocket): void {
    for (const roomId of [...socket.data.rooms]) {
      this.detachSocketFromRoom(socket, roomId);
    }

    this.documents.detachSocket(socket);
    this.rateWindows.delete(socket.id);

    const sessionSockets = this.sessions.get(socket.data.sessionId);

    if (!sessionSockets) {
      return;
    }

    sessionSockets.delete(socket.id);

    if (sessionSockets.size === 0) {
      this.sessions.delete(socket.data.sessionId);
    }
  }

  private addPresence(
    roomId: string,
    userId: string,
    displayName: string,
    socketId: string,
  ): boolean {
    const roomPresence = this.presence.get(roomId) ?? new Map<string, PresenceUser>();

    if (!this.presence.has(roomId)) {
      this.presence.set(roomId, roomPresence);
    }

    const existing = roomPresence.get(userId);

    if (existing) {
      existing.connections.add(socketId);
      existing.displayName = displayName;
      return false;
    }

    roomPresence.set(userId, {
      userId,
      displayName,
      connections: new Set([socketId]),
    });

    return true;
  }

  private detachSocketFromRoom(
    socket: RoomSocket,
    roomId: string,
    announce = true,
  ): void {
    if (!socket.data.rooms.delete(roomId)) {
      return;
    }

    socket.leave(roomId);

    const roomPresence = this.presence.get(roomId);

    if (!roomPresence) {
      return;
    }

    const presenceUser = roomPresence.get(socket.data.userId);

    if (!presenceUser) {
      return;
    }

    presenceUser.connections.delete(socket.id);

    if (presenceUser.connections.size > 0) {
      return;
    }

    roomPresence.delete(socket.data.userId);

    if (roomPresence.size === 0) {
      this.presence.delete(roomId);
    }

    if (!announce) {
      return;
    }

    this.io.to(roomId).emit(SERVER_EVENTS.presenceMemberLeft, {
      roomId,
      member: { userId: presenceUser.userId, displayName: presenceUser.displayName },
    });
  }

  private emitSnapshot(socket: RoomSocket, roomId: string): void {
    const snapshot: PresenceSnapshot = {
      roomId,
      onlineMembers: this.getOnlineMembers(roomId),
    };
    socket.emit(SERVER_EVENTS.presenceSnapshot, snapshot);
  }

  private consumeRoomAction(
    socket: RoomSocket,
    acknowledge?: (result: RoomActionResult) => void,
  ): boolean {
    const now = Date.now();
    const current = this.rateWindows.get(socket.id);
    const window =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + ROOM_ACTION_WINDOW_MS };

    window.count += 1;
    this.rateWindows.set(socket.id, window);

    if (window.count > ROOM_ACTION_LIMIT) {
      this.reply(socket, acknowledge, {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Too many room actions. Try again shortly.' },
      });
      return false;
    }

    return true;
  }

  private reply(
    socket: RoomSocket,
    acknowledge: ((result: RoomActionResult) => void) | undefined,
    result: RoomActionResult,
  ): void {
    if (typeof acknowledge === 'function') {
      acknowledge(result);
      return;
    }

    if (!result.ok) {
      socket.emit(SERVER_EVENTS.presenceError, result.error);
    }
  }
}
