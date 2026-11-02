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

export interface RealtimeError {
  code: string;
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

export interface DocumentMessage {
  roomId: string;
  documentId: string;
  message: Uint8Array;
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
}

export interface ServerToClientEvents {
  'presence:snapshot': (payload: PresenceSnapshot) => void;
  'presence:member_joined': (payload: PresenceMemberEvent) => void;
  'presence:member_left': (payload: PresenceMemberEvent) => void;
  'presence:error': (payload: RealtimeError) => void;
  'room:access_revoked': (payload: RoomAccessRevoked) => void;
  'document:message': (payload: DocumentMessage) => void;
  'document:error': (payload: RealtimeError) => void;
}
