import type { Socket } from 'socket.io';
import { z } from 'zod';

export const CLIENT_EVENTS = {
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  documentSubscribe: 'document:subscribe',
  documentUnsubscribe: 'document:unsubscribe',
  documentMessage: 'document:message',
  sendMessage: 'chat:sendMessage',
  messageEdited: 'chat:messageEdited',
  messageDeleted: 'chat:messageDeleted',
  typingStart: 'chat:typingStart',
  typingStop: 'chat:typingStop',
  joinChat: 'chat:joinChat',
  leaveChat: 'chat:leaveChat',
} as const;

export const SERVER_EVENTS = {
  presenceSnapshot: 'presence:snapshot',
  presenceMemberJoined: 'presence:member_joined',
  presenceMemberLeft: 'presence:member_left',
  presenceError: 'presence:error',
  roomAccessRevoked: 'room:access_revoked',
  documentMessage: 'document:message',
  documentError: 'document:error',
  messageReceived: 'chat:messageReceived',
  messageEdited: 'chat:messageEdited',
  messageDeleted: 'chat:messageDeleted',
  typingStart: 'chat:typingStart',
  typingStop: 'chat:typingStop',
} as const;

const roomId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID');
const documentId = z.literal('main');

export const roomTargetSchema = z.object({ roomId }).strict();
export const documentTargetSchema = z.object({ roomId, documentId }).strict();
export const documentMessageSchema = z
  .object({
    roomId,
    documentId,
    message: z.instanceof(Uint8Array),
  })
  .strict();

export interface OnlineRoomMember {
  userId: string;
  displayName: string;
}

export interface PresenceSnapshot {
  roomId: string;
  onlineMembers: OnlineRoomMember[];
}

export interface PresenceMemberEvent {
  roomId: string;
  member: OnlineRoomMember;
}

export interface DocumentMessage {
  roomId: string;
  documentId: string;
  message: Uint8Array;
}

export type RealtimeErrorCode =
  | 'INVALID_PAYLOAD'
  | 'UNSUPPORTED_EVENT'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'ROOM_ARCHIVED'
  | 'RATE_LIMITED'
  | 'DOCUMENT_TOO_LARGE'
  | 'DOCUMENT_NOT_SUBSCRIBED'
  | 'DOCUMENT_INVALID_MESSAGE'
  | 'INTERNAL_ERROR';

export interface RealtimeError {
  code: RealtimeErrorCode;
  message: string;
}

export type RoomActionResult = { ok: true } | { ok: false; error: RealtimeError };

export type AccessRevokedReason =
  | 'MEMBERSHIP_REVOKED'
  | 'ROOM_ARCHIVED'
  | 'ROOM_DELETED'
  | 'SESSION_ENDED';

export interface RoomAccessRevoked {
  roomId: string;
  reason: AccessRevokedReason;
}

export interface ClientToServerEvents {
  'room:join': (payload: unknown, acknowledge?: (result: RoomActionResult) => void) => void;
  'room:leave': (payload: unknown, acknowledge?: (result: RoomActionResult) => void) => void;
  'document:subscribe': (
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ) => void;
  'document:unsubscribe': (
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ) => void;
  'document:message': (
    payload: unknown,
    acknowledge?: (result: RoomActionResult) => void,
  ) => void;
  sendMessage: (payload: { content: string; replyTo?: string }) => void;
  messageEdited: (payload: { messageId: string; content: string }) => void;
  messageDeleted: (payload: { messageId: string }) => void;
  typingStart: (payload: { userId: string; displayName: string }) => void;
  typingStop: (payload: { userId: string }) => void;
  joinChat: (payload: unknown, acknowledge?: (result: RoomActionResult) => void) => void;
  leaveChat: (payload: unknown, acknowledge?: (result: RoomActionResult) => void) => void;
}

export interface ServerToClientEvents {
  'presence:snapshot': (payload: PresenceSnapshot) => void;
  'presence:member_joined': (payload: PresenceMemberEvent) => void;
  'presence:member_left': (payload: PresenceMemberEvent) => void;
  'presence:error': (payload: RealtimeError) => void;
  'room:access_revoked': (payload: RoomAccessRevoked) => void;
  'document:message': (payload: DocumentMessage) => void;
  'document:error': (payload: RealtimeError) => void;
  messageReceived: (payload: MessageReceived) => void;
  messageEdited: (payload: MessageEdited) => void;
  messageDeleted: (payload: MessageDeleted) => void;
  typingStart: (payload: TypingStart) => void;
  typingStop: (payload: TypingStop) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  sessionId: string;
  rooms: Set<string>;
  documents: Set<string>;
  roomId?: string;
  projectId?: string;
  displayName?: string;
}

export interface MessageReceived {
  messageId: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  replyTo?: string | null;
}

export interface MessageEdited {
  messageId: string;
  content: string;
  editedAt: string;
  senderId: string;
}

export interface MessageDeleted {
  messageId: string;
  deleted: boolean;
}

export interface TypingStart {
  userId: string;
  displayName: string;
}

export interface TypingStop {
  userId: string;
}

export type RoomSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;