import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/api/errors';
import {
  fetchRoom,
  fetchRooms,
  type RoomDetail,
  type RoomSummary,
} from '../lib/api/rooms';

interface RoomsState {
  rooms: RoomSummary[];
  error: string | null;
  isLoading: boolean;
}

const initialRoomsState: RoomsState = {
  rooms: [],
  error: null,
  isLoading: true,
};

export function useRooms() {
  const [state, setState] = useState<RoomsState>(initialRoomsState);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const rooms = await fetchRooms();
      if (isActive()) {
        setState({ rooms, error: null, isLoading: false });
      }
    } catch (error) {
      if (isActive()) {
        setState({
          rooms: [],
          error: errorMessage(error, 'Rooms could not be loaded.'),
          isLoading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, refetch };
}

interface RoomState {
  room: RoomDetail | null;
  error: string | null;
  isLoading: boolean;
}

const initialRoomState: RoomState = {
  room: null,
  error: null,
  isLoading: true,
};

export function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState>(initialRoomState);

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const room = await fetchRoom(roomId);
        if (isActive()) {
          setState({ room, error: null, isLoading: false });
        }
      } catch (error) {
        if (isActive()) {
          setState({
            room: null,
            error: errorMessage(error, 'This room could not be loaded.'),
            isLoading: false,
          });
        }
      }
    },
    [roomId],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  const replaceRoom = useCallback((room: RoomDetail) => {
    setState({ room, error: null, isLoading: false });
  }, []);

  return { ...state, refetch, replaceRoom };
}
