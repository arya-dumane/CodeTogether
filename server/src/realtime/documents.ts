import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import type { Server } from 'socket.io';
import {
  SERVER_EVENTS,
  type AccessRevokedReason,
  type DocumentMessage,
  type InterServerEvents,
  type RoomSocket,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type SocketData,
} from './events.js';

export const DOCUMENT_ID = 'main';
export const MAX_DOCUMENT_MESSAGE_BYTES = 256 * 1024;
export const MAX_DOCUMENT_STATE_BYTES = 192 * 1024;
export const MAX_DOCUMENT_MESSAGES_PER_WINDOW = 200;
export const MAX_DOCUMENT_BYTES_PER_WINDOW = 2 * 1024 * 1024;
export const DOCUMENT_RATE_WINDOW_MS = 10_000;

type DocumentSocket = RoomSocket;

type RealtimeIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface ManagedDocument {
  roomId: string;
  documentId: string;
  channel: string;
  doc: Doc;
  subscribers: Map<string, string>;
  stateBytes: number;
}

interface RateWindow {
  count: number;
  bytes: number;
  resetAt: number;
}

export class DocumentMessageError extends Error {
  readonly code: 'DOCUMENT_TOO_LARGE' | 'DOCUMENT_INVALID_MESSAGE';

  constructor(
    code: 'DOCUMENT_TOO_LARGE' | 'DOCUMENT_INVALID_MESSAGE',
    message: string,
  ) {
    super(message);
    this.name = 'DocumentMessageError';
    this.code = code;
  }
}

function documentKey(roomId: string, documentId: string): string {
  return `${roomId}:${documentId}`;
}

function documentChannel(roomId: string, documentId: string): string {
  return `doc:${roomId}:${documentId}`;
}

function encodeMessage(
  write: (encoder: encoding.Encoder) => void,
): Uint8Array {
  const encoder = encoding.createEncoder();
  write(encoder);
  const message = encoding.toUint8Array(encoder);

  if (message.byteLength > MAX_DOCUMENT_MESSAGE_BYTES) {
    throw new DocumentMessageError(
      'DOCUMENT_TOO_LARGE',
      'Document message exceeds the allowed size',
    );
  }

  return message;
}

export class DocumentHub {
  private readonly io: RealtimeIo;
  private readonly documents = new Map<string, ManagedDocument>();
  private readonly socketDocuments = new Map<string, Set<string>>();
  private readonly rateWindows = new Map<string, RateWindow>();

  constructor(io: RealtimeIo) {
    this.io = io;
  }

  get documentCount(): number {
    return this.documents.size;
  }

  get subscriptionCount(): number {
    let count = 0;

    for (const document of this.documents.values()) {
      count += document.subscribers.size;
    }

    return count;
  }

  hasSubscription(socket: DocumentSocket, roomId: string, documentId: string): boolean {
    return socket.data.documents.has(documentKey(roomId, documentId));
  }

  getDocument(roomId: string, documentId: string): ManagedDocument | null {
    return this.documents.get(documentKey(roomId, documentId)) ?? null;
  }

  listSubscriptions(): Array<{ socketId: string; userId: string; roomId: string }> {
    const subscriptions: Array<{ socketId: string; userId: string; roomId: string }> = [];

    for (const document of this.documents.values()) {
      for (const [socketId, userId] of document.subscribers) {
        subscriptions.push({ socketId, userId, roomId: document.roomId });
      }
    }

    return subscriptions;
  }

  subscribe(
    socket: DocumentSocket,
    roomId: string,
    documentId: string,
  ): ManagedDocument {
    const key = documentKey(roomId, documentId);
    const document = this.getOrCreate(roomId, documentId);

    document.subscribers.set(socket.id, socket.data.userId);
    socket.data.documents.add(key);
    socket.join(document.channel);

    const socketKeys = this.socketDocuments.get(socket.id) ?? new Set<string>();
    socketKeys.add(key);
    this.socketDocuments.set(socket.id, socketKeys);

    return document;
  }

  unsubscribe(socket: DocumentSocket, roomId: string, documentId: string): void {
    const document = this.documents.get(documentKey(roomId, documentId));

    if (document) {
      this.removeSubscriber(socket, document);
    }
  }

  detachSocket(socket: DocumentSocket): void {
    const keys = this.socketDocuments.get(socket.id);

    if (!keys) {
      return;
    }

    for (const key of [...keys]) {
      const document = this.documents.get(key);

      if (document) {
        this.removeSubscriber(socket, document);
      }
    }

    this.socketDocuments.delete(socket.id);
    this.rateWindows.delete(socket.id);
  }

  revokeSocket(socket: DocumentSocket, reason: AccessRevokedReason): void {
    const roomIds = new Set<string>();

    for (const key of socket.data.documents) {
      roomIds.add(key.slice(0, key.indexOf(':')));
    }

    for (const roomId of roomIds) {
      socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
    }

    this.detachSocket(socket);
  }

  revokeUserFromRoom(
    userId: string,
    roomId: string,
    reason: AccessRevokedReason,
  ): void {
    const affectedSockets = new Set<string>();
    const affectedKeys = new Set<string>();

    for (const [key, document] of this.documents) {
      if (document.roomId !== roomId) {
        continue;
      }

      for (const [socketId, subscriberId] of document.subscribers) {
        if (subscriberId === userId) {
          affectedSockets.add(socketId);
          affectedKeys.add(key);
        }
      }
    }

    for (const socketId of affectedSockets) {
      const socket = this.io.sockets.sockets.get(socketId) as DocumentSocket | undefined;

      if (socket) {
        socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
      }
    }

    for (const key of affectedKeys) {
      const document = this.documents.get(key);

      if (!document) {
        continue;
      }

      for (const [socketId, subscriberId] of [...document.subscribers]) {
        if (subscriberId !== userId) {
          continue;
        }

        const socket = this.io.sockets.sockets.get(socketId) as DocumentSocket | undefined;

        if (socket) {
          this.removeSubscriber(socket, document);
        } else {
          document.subscribers.delete(socketId);
          this.socketDocuments.get(socketId)?.delete(key);
        }
      }
    }
  }

  closeRoom(roomId: string, reason: AccessRevokedReason): void {
    const affectedSockets = new Set<string>();
    const roomDocuments: ManagedDocument[] = [];

    for (const document of this.documents.values()) {
      if (document.roomId !== roomId) {
        continue;
      }

      roomDocuments.push(document);

      for (const socketId of document.subscribers.keys()) {
        affectedSockets.add(socketId);
      }
    }

    for (const socketId of affectedSockets) {
      const socket = this.io.sockets.sockets.get(socketId) as DocumentSocket | undefined;

      if (socket) {
        socket.emit(SERVER_EVENTS.roomAccessRevoked, { roomId, reason });
      }
    }

    for (const document of roomDocuments) {
      for (const socketId of [...document.subscribers.keys()]) {
        const socket = this.io.sockets.sockets.get(socketId) as DocumentSocket | undefined;

        if (socket) {
          this.removeSubscriber(socket, document);
        } else {
          document.subscribers.delete(socketId);
          this.socketDocuments.get(socketId)?.delete(documentKey(roomId, document.documentId));
        }
      }

      if (reason === 'ROOM_DELETED') {
        document.doc.destroy();
        this.documents.delete(documentKey(roomId, document.documentId));
      }
    }
  }

  consumeRate(socketId: string, bytes: number): boolean {
    const now = Date.now();
    const current = this.rateWindows.get(socketId);
    const window =
      current && current.resetAt > now
        ? current
        : { count: 0, bytes: 0, resetAt: now + DOCUMENT_RATE_WINDOW_MS };

    window.count += 1;
    window.bytes += bytes;
    this.rateWindows.set(socketId, window);

    return (
      window.count <= MAX_DOCUMENT_MESSAGES_PER_WINDOW &&
      window.bytes <= MAX_DOCUMENT_BYTES_PER_WINDOW
    );
  }

  handleMessage(
    socket: DocumentSocket,
    document: ManagedDocument,
    message: Uint8Array,
  ): Uint8Array[] {
    if (message.byteLength === 0 || message.byteLength > MAX_DOCUMENT_MESSAGE_BYTES) {
      throw new DocumentMessageError(
        'DOCUMENT_TOO_LARGE',
        'Document message exceeds the allowed size',
      );
    }

    const decoder = decoding.createDecoder(message);
    let messageType: number;

    try {
      messageType = decoding.readVarUint(decoder);
    } catch {
      throw new DocumentMessageError('DOCUMENT_INVALID_MESSAGE', 'Invalid Yjs message');
    }

    if (messageType === syncProtocol.messageYjsSyncStep1) {
      try {
        const stateVector = decoding.readVarUint8Array(decoder);

        if (decoding.hasContent(decoder)) {
          throw new Error('Unexpected trailing bytes');
        }

        const step2 = encodeMessage((encoder) => {
          syncProtocol.writeSyncStep2(encoder, document.doc, stateVector);
        });
        const step1 = encodeMessage((encoder) => {
          syncProtocol.writeSyncStep1(encoder, document.doc);
        });

        return [step2, step1];
      } catch (error) {
        if (error instanceof DocumentMessageError) {
          throw error;
        }

        throw new DocumentMessageError('DOCUMENT_INVALID_MESSAGE', 'Invalid Yjs sync message');
      }
    }

    if (
      messageType !== syncProtocol.messageYjsSyncStep2 &&
      messageType !== syncProtocol.messageYjsUpdate
    ) {
      throw new DocumentMessageError('DOCUMENT_INVALID_MESSAGE', 'Unsupported Yjs message type');
    }

    let update: Uint8Array;

    try {
      update = decoding.readVarUint8Array(decoder);

      if (decoding.hasContent(decoder)) {
        throw new Error('Unexpected trailing bytes');
      }
    } catch {
      throw new DocumentMessageError('DOCUMENT_INVALID_MESSAGE', 'Invalid Yjs update message');
    }

    if (document.stateBytes + update.byteLength > MAX_DOCUMENT_STATE_BYTES) {
      throw new DocumentMessageError(
        'DOCUMENT_TOO_LARGE',
        'Document exceeds the allowed size',
      );
    }

    try {
      applyUpdate(document.doc, update, socket.id);
    } catch {
      throw new DocumentMessageError('DOCUMENT_INVALID_MESSAGE', 'Invalid Yjs update');
    }

    return [];
  }

  close(): void {
    for (const document of this.documents.values()) {
      document.doc.destroy();
    }

    this.documents.clear();
    this.socketDocuments.clear();
    this.rateWindows.clear();
  }

  private getOrCreate(roomId: string, documentId: string): ManagedDocument {
    const key = documentKey(roomId, documentId);
    const existing = this.documents.get(key);

    if (existing) {
      return existing;
    }

    const doc = new Doc();
    const document: ManagedDocument = {
      roomId,
      documentId,
      channel: documentChannel(roomId, documentId),
      doc,
      subscribers: new Map(),
      stateBytes: 0,
    };

    doc.on('update', (update, origin) => {
      document.stateBytes = Math.max(
        document.stateBytes,
        encodeStateAsUpdate(doc).byteLength,
      );

      const payload: DocumentMessage = {
        roomId,
        documentId,
        message: encodeMessage((encoder) => {
          syncProtocol.writeUpdate(encoder, update);
        }),
      };

      if (typeof origin !== 'string') {
        this.io.to(document.channel).emit(SERVER_EVENTS.documentMessage, payload);
        return;
      }

      this.io
        .to(document.channel)
        .except(origin)
        .emit(SERVER_EVENTS.documentMessage, payload);
    });

    this.documents.set(key, document);
    return document;
  }

  private removeSubscriber(socket: DocumentSocket, document: ManagedDocument): void {
    const key = documentKey(document.roomId, document.documentId);

    document.subscribers.delete(socket.id);
    socket.data.documents.delete(key);
    socket.leave(document.channel);

    const keys = this.socketDocuments.get(socket.id);
    keys?.delete(key);

    if (keys && keys.size === 0) {
      this.socketDocuments.delete(socket.id);
    }
  }
}
