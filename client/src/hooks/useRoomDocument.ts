import { useEffect, useState } from 'react';
import type { Doc } from 'yjs';
import {
  DOCUMENT_ID,
  RoomDocumentProvider,
  initialRoomDocumentState,
  type RoomDocumentState,
} from '../lib/realtime/documents';
import { useAuth } from './useAuth';

export function useRoomDocument(roomId: string, enabled = true) {
  const { status } = useAuth();
  const [state, setState] = useState<RoomDocumentState>(initialRoomDocumentState);
  const [doc, setDoc] = useState<Doc | null>(null);

  useEffect(() => {
    if (!enabled || status !== 'authenticated' || !roomId) {
      setState(initialRoomDocumentState);
      setDoc(null);
      return;
    }

    const provider = new RoomDocumentProvider(roomId, DOCUMENT_ID, setState);
    setDoc(provider.doc);
    provider.connect();

    return () => {
      provider.destroy();
      setDoc(null);
    };
  }, [enabled, roomId, status]);

  return { doc, state };
}
