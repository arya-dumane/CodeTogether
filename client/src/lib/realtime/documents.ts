import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Doc, applyUpdate, mergeUpdates } from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import { AUTH_UNAUTHORIZED_EVENT } from '../api/client';
import {
  createRealtimeSocket,
  type RoomSocket,
} from './socket';
import type {
  AccessRevokedReason,
  DocumentMessage,
  RealtimeError,
  RoomAccessRevoked,
  RoomActionResult,
} from './events';

export const DOCUMENT_ID = 'main';
const UPDATE_BATCH_MS = 50;
const PROVIDER_ORIGIN = Symbol('collaborative-document-provider');

export type DocumentConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'synced'
  | 'offline'
  | 'revoked'
  | 'error';

export interface RoomDocumentState {
  status: DocumentConnectionStatus;
  error: string | null;
  isReadOnly: boolean;
  hasSynced: boolean;
  accessRevokedReason: AccessRevokedReason | null;
}

export const initialRoomDocumentState: RoomDocumentState = {
  status: 'idle',
  error: null,
  isReadOnly: true,
  hasSynced: false,
  accessRevokedReason: null,
};

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  return null;
}

function revokedMessage(reason: AccessRevokedReason): string {
  switch (reason) {
    case 'ROOM_ARCHIVED':
      return 'This room is archived. Live editing is paused.';
    case 'ROOM_DELETED':
      return 'This room was deleted.';
    case 'SESSION_ENDED':
      return 'Your session ended. Sign in again to continue editing.';
    default:
      return 'You no longer have access to this room.';
  }
}

export class RoomDocumentProvider {
  readonly doc = new Doc();

  private readonly roomId: string;
  private readonly documentId: string;
  private readonly onState: (state: RoomDocumentState) => void;
  private readonly socket: RoomSocket;
  private pendingUpdates: Uint8Array[] = [];
  private flushTimer: number | null = null;
  private active = true;
  private subscribed = false;
  private hasSynced = false;
  private fatal = false;
  private revoked = false;
  private subscribeGeneration = 0;

  constructor(
    roomId: string,
    documentId: string,
    onState: (state: RoomDocumentState) => void,
  ) {
    this.roomId = roomId;
    this.documentId = documentId;
    this.onState = onState;
    this.socket = createRealtimeSocket();

    this.doc.on('update', this.handleLocalUpdate);
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('document:message', this.handleDocumentMessage);
    this.socket.on('document:error', this.handleDocumentError);
    this.socket.on('room:access_revoked', this.handleAccessRevoked);
  }

  connect(): void {
    this.updateState({
      status: 'connecting',
      error: null,
      isReadOnly: !this.hasSynced,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
    this.socket.connect();
  }

  destroy(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.subscribed = false;
    this.clearPendingUpdates();

    if (this.socket.connected) {
      this.socket.emit('document:unsubscribe', {
        roomId: this.roomId,
        documentId: this.documentId,
      });
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.doc.off('update', this.handleLocalUpdate);
    this.doc.destroy();
  }

  private handleConnect = (): void => {
    if (!this.active || this.fatal || this.revoked) {
      return;
    }

    this.updateState({
      status: 'connecting',
      error: null,
      isReadOnly: !this.hasSynced,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
    this.subscribe();
  };

  private handleDisconnect = (): void => {
    if (!this.active || this.fatal || this.revoked) {
      return;
    }

    this.subscribed = false;
    this.subscribeGeneration += 1;
    this.clearPendingUpdates();
    this.updateState({
      status: 'offline',
      error: 'Document connection lost. Reconnecting will resynchronize your edits.',
      isReadOnly: !this.hasSynced,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
  };

  private handleConnectError = (error: Error): void => {
    if (!this.active) {
      return;
    }

    const data = (error as Error & { data?: { code?: string } }).data;

    if (data?.code === 'UNAUTHENTICATED' || error.message === 'Authentication required') {
      this.failWithoutReconnect('Your session ended. Sign in again to continue editing.');
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      return;
    }

    this.updateState({
      status: 'offline',
      error: 'Document service unavailable. Reconnecting…',
      isReadOnly: !this.hasSynced,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
  };

  private handleAccessRevoked = (event: RoomAccessRevoked): void => {
    if (!this.active || event.roomId !== this.roomId) {
      return;
    }

    this.revoked = true;
    this.subscribed = false;
    this.subscribeGeneration += 1;
    this.clearPendingUpdates();
    this.updateState({
      status: 'revoked',
      error: revokedMessage(event.reason),
      isReadOnly: true,
      hasSynced: this.hasSynced,
      accessRevokedReason: event.reason,
    });
    this.socket.disconnect();

    if (event.reason === 'SESSION_ENDED') {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
  };

  private handleDocumentError = (error: RealtimeError): void => {
    if (!this.active) {
      return;
    }

    if (error.code === 'UNAUTHENTICATED') {
      this.failWithoutReconnect('Your session ended. Sign in again to continue editing.');
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      return;
    }

    if (error.code === 'NOT_FOUND' || error.code === 'ROOM_ARCHIVED') {
      this.revoked = true;
      this.subscribed = false;
      this.updateState({
        status: 'revoked',
        error: error.message,
        isReadOnly: true,
        hasSynced: this.hasSynced,
        accessRevokedReason:
          error.code === 'ROOM_ARCHIVED' ? 'ROOM_ARCHIVED' : 'MEMBERSHIP_REVOKED',
      });
      this.socket.disconnect();
      return;
    }

    if (
      error.code === 'DOCUMENT_TOO_LARGE' ||
      error.code === 'DOCUMENT_INVALID_MESSAGE' ||
      error.code === 'RATE_LIMITED'
    ) {
      this.failWithoutReconnect(error.message);
      return;
    }

    if (error.code === 'DOCUMENT_NOT_SUBSCRIBED') {
      this.subscribed = false;

      if (this.socket.connected) {
        this.subscribe();
      }

      return;
    }

    this.updateState({
      status: 'error',
      error: error.message,
      isReadOnly: !this.hasSynced,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
  };

  private handleDocumentMessage = (payload: DocumentMessage): void => {
    if (
      !this.active ||
      this.fatal ||
      this.revoked ||
      payload.roomId !== this.roomId ||
      payload.documentId !== this.documentId
    ) {
      return;
    }

    const message = toUint8Array(payload.message);

    if (!message) {
      this.failWithoutReconnect('The document service sent an invalid message.');
      return;
    }

    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === syncProtocol.messageYjsSyncStep1) {
        const stateVector = decoding.readVarUint8Array(decoder);

        if (decoding.hasContent(decoder)) {
          throw new Error('Unexpected trailing bytes');
        }

        this.sendProtocolMessage((encoder) => {
          syncProtocol.writeSyncStep2(encoder, this.doc, stateVector);
        });
      } else if (
        messageType === syncProtocol.messageYjsSyncStep2 ||
        messageType === syncProtocol.messageYjsUpdate
      ) {
        const update = decoding.readVarUint8Array(decoder);

        if (decoding.hasContent(decoder)) {
          throw new Error('Unexpected trailing bytes');
        }

        applyUpdate(this.doc, update, PROVIDER_ORIGIN);
      } else {
        throw new Error('Unsupported Yjs message type');
      }

      if (!this.hasSynced) {
        this.hasSynced = true;
      }

      this.updateState({
        status: 'synced',
        error: null,
        isReadOnly: this.fatal || this.revoked,
        hasSynced: true,
        accessRevokedReason: null,
      });
    } catch {
      this.failWithoutReconnect('The document service sent an invalid message.');
    }
  };

  private handleLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (
      !this.active ||
      origin === PROVIDER_ORIGIN ||
      !this.subscribed ||
      !this.socket.connected ||
      this.fatal ||
      this.revoked
    ) {
      return;
    }

    this.pendingUpdates.push(update);

    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flushUpdates();
    }, UPDATE_BATCH_MS);
  };

  private subscribe(): void {
    const generation = ++this.subscribeGeneration;

    this.socket.emit(
      'document:subscribe',
      { roomId: this.roomId, documentId: this.documentId },
      (result: RoomActionResult) => {
        if (!this.active || generation !== this.subscribeGeneration) {
          return;
        }

        if (!result.ok) {
          this.handleSubscribeError(result.error);
          return;
        }

        this.subscribed = true;
        this.sendProtocolMessage((encoder) => {
          syncProtocol.writeSyncStep1(encoder, this.doc);
        });
      },
    );
  }

  private handleSubscribeError(error: RealtimeError): void {
    if (error.code === 'UNAUTHENTICATED') {
      this.failWithoutReconnect('Your session ended. Sign in again to continue editing.');
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      return;
    }

    if (error.code === 'NOT_FOUND' || error.code === 'ROOM_ARCHIVED') {
      this.revoked = true;
      this.updateState({
        status: 'revoked',
        error: error.message,
        isReadOnly: true,
        hasSynced: this.hasSynced,
        accessRevokedReason:
          error.code === 'ROOM_ARCHIVED' ? 'ROOM_ARCHIVED' : 'MEMBERSHIP_REVOKED',
      });
      this.socket.disconnect();
      return;
    }

    if (error.code === 'RATE_LIMITED' || error.code === 'INVALID_PAYLOAD') {
      this.failWithoutReconnect(error.message);
      return;
    }

    this.updateState({
      status: 'error',
      error: error.message,
      isReadOnly: true,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
  }

  private flushUpdates(): void {
    if (!this.subscribed || !this.socket.connected || this.pendingUpdates.length === 0) {
      this.pendingUpdates = [];
      return;
    }

    const update = mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    this.sendProtocolMessage((encoder) => {
      syncProtocol.writeUpdate(encoder, update);
    });
  }

  private sendProtocolMessage(write: (encoder: encoding.Encoder) => void): void {
    if (!this.active || this.fatal || this.revoked || !this.socket.connected) {
      return;
    }

    const encoder = encoding.createEncoder();
    write(encoder);
    const message = encoding.toUint8Array(encoder);

    this.socket.emit('document:message', {
      roomId: this.roomId,
      documentId: this.documentId,
      message,
    });
  }

  private clearPendingUpdates(): void {
    this.pendingUpdates = [];

    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private failWithoutReconnect(message: string): void {
    this.fatal = true;
    this.subscribed = false;
    this.subscribeGeneration += 1;
    this.clearPendingUpdates();
    this.updateState({
      status: 'error',
      error: message,
      isReadOnly: true,
      hasSynced: this.hasSynced,
      accessRevokedReason: null,
    });
    this.socket.disconnect();
  }

  private updateState(next: RoomDocumentState): void {
    this.onState(next);
  }
}
