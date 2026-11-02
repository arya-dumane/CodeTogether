import { useEffect, useState } from 'react';
import { AUTH_UNAUTHORIZED_EVENT } from '../lib/api/client';
import type {
  AccessRevokedReason,
  OnlineRoomMember,
  PresenceMemberEvent,
  PresenceSnapshot,
  RealtimeError,
  RoomAccessRevoked,
  RoomActionResult,
} from '../lib/realtime/events';
import { createPresenceSocket } from '../lib/realtime/socket';
import { useAuth } from './useAuth';

interface PresenceState {
  onlineMembers: OnlineRoomMember[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  accessRevokedReason: AccessRevokedReason | null;
}

const emptyPresence: PresenceState = {
  onlineMembers: [],
  isConnected: false,
  isLoading: false,
  error: null,
  accessRevokedReason: null,
};

export function useRoomPresence(roomId: string, enabled = true) {
  const { status } = useAuth();
  const [state, setState] = useState<PresenceState>(emptyPresence);

  useEffect(() => {
    if (!enabled || status !== 'authenticated' || !roomId) {
      setState(emptyPresence);
      return;
    }

    let active = true;
    const socket = createPresenceSocket();

    setState({
      onlineMembers: [],
      isConnected: false,
      isLoading: true,
      error: null,
      accessRevokedReason: null,
    });

    const joinRoom = () => {
      socket.emit('room:join', { roomId }, (result: RoomActionResult) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setState((current) => ({ ...current, isLoading: false, error: null }));
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: result.error.message,
        }));

        if (result.error.code === 'UNAUTHENTICATED') {
          window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
        }
      });
    };

    const handleConnect = () => {
      if (!active) {
        return;
      }

      setState((current) => ({ ...current, isConnected: true, error: null }));
      joinRoom();
    };

    const handleDisconnect = () => {
      if (!active) {
        return;
      }

      setState((current) => ({
        ...current,
        onlineMembers: [],
        isConnected: false,
        isLoading: false,
      }));
    };

    const handleConnectError = (error: Error) => {
      if (!active) {
        return;
      }

      const data = (error as Error & { data?: { code?: string } }).data;

      setState((current) => ({
        ...current,
        onlineMembers: [],
        isConnected: false,
        isLoading: false,
        error: 'Live presence is currently unavailable.',
      }));

      if (data?.code === 'UNAUTHENTICATED' || error.message === 'Authentication required') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    };

    const handleSnapshot = (snapshot: PresenceSnapshot) => {
      if (!active || snapshot.roomId !== roomId) {
        return;
      }

      setState((current) => ({
        ...current,
        onlineMembers: snapshot.onlineMembers,
        isLoading: false,
        error: null,
      }));
    };

    const handleMemberJoined = (event: PresenceMemberEvent) => {
      if (!active || event.roomId !== roomId) {
        return;
      }

      setState((current) => {
        if (current.onlineMembers.some((member) => member.userId === event.member.userId)) {
          return current;
        }

        return {
          ...current,
          onlineMembers: [...current.onlineMembers, event.member],
        };
      });
    };

    const handleMemberLeft = (event: PresenceMemberEvent) => {
      if (!active || event.roomId !== roomId) {
        return;
      }

      setState((current) => ({
        ...current,
        onlineMembers: current.onlineMembers.filter(
          (member) => member.userId !== event.member.userId,
        ),
      }));
    };

    const handleAccessRevoked = (event: RoomAccessRevoked) => {
      if (!active || event.roomId !== roomId) {
        return;
      }

      setState((current) => ({
        ...current,
        onlineMembers: [],
        isLoading: false,
        accessRevokedReason: event.reason,
      }));

      if (event.reason === 'SESSION_ENDED') {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    };

    const handleError = (error: RealtimeError) => {
      if (!active) {
        return;
      }

      setState((current) => ({ ...current, error: error.message, isLoading: false }));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('presence:snapshot', handleSnapshot);
    socket.on('presence:member_joined', handleMemberJoined);
    socket.on('presence:member_left', handleMemberLeft);
    socket.on('presence:error', handleError);
    socket.on('room:access_revoked', handleAccessRevoked);
    socket.connect();

    return () => {
      active = false;
      socket.emit('room:leave', { roomId });
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [enabled, roomId, status]);

  return state;
}
