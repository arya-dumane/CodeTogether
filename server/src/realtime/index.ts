import type { Server as HttpServer } from 'node:http';
import type { AccessRevokedReason } from './events.js';
import { RealtimeServer, type RealtimeServerOptions } from './server.js';

let activeRealtime: RealtimeServer | null = null;

export function initializeRealtime(
  server: HttpServer,
  options?: RealtimeServerOptions,
): RealtimeServer {
  if (activeRealtime) {
    throw new Error('Realtime server is already initialized');
  }

  activeRealtime = new RealtimeServer(server, options);
  return activeRealtime;
}

export function getRealtime(): RealtimeServer | null {
  return activeRealtime;
}

export function revokeUserRoomAccess(
  userId: string,
  roomId: string,
  reason: AccessRevokedReason,
): void {
  activeRealtime?.revokeUserFromRoom(userId, roomId, reason);
}

export function closeRoomPresence(roomId: string, reason: AccessRevokedReason): void {
  activeRealtime?.closeRoom(roomId, reason);
}

export function disconnectSessionPresence(
  sessionId: string,
  reason: AccessRevokedReason = 'SESSION_ENDED',
): void {
  activeRealtime?.disconnectSession(sessionId, reason);
}

export async function closeRealtime(): Promise<void> {
  const realtime = activeRealtime;
  activeRealtime = null;

  if (realtime) {
    await realtime.close();
  }
}
