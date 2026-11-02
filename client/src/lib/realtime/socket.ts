import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './events';

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function resolveSocketUrl(): string | undefined {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (!configured) {
    return undefined;
  }

  try {
    return new URL(configured, window.location.origin).origin;
  } catch {
    return undefined;
  }
}

export function createRealtimeSocket(): RoomSocket {
  return io(resolveSocketUrl(), {
    path: '/socket.io',
    withCredentials: true,
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    timeout: 10_000,
  });
}

export const createPresenceSocket = createRealtimeSocket;
