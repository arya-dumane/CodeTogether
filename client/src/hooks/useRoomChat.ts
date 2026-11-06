import { useEffect, useState } from 'react';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  replyTo?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
}

interface UseRoomChatReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string, replyTo?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  loadMoreMessages: (page: number) => Promise<void>;
}

function useRoomChat(roomId: string): UseRoomChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadMessages = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      setPagination({ page, limit: 50, total: 0, pages: 0 });
      setMessages([]);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load messages');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [roomId]);

  return {
    messages,
    loading,
    error,
    sendMessage: async () => {},
    editMessage: async () => {},
    deleteMessage: async () => {},
    pagination,
    loadMoreMessages: (page: number) => loadMessages(page),
  };
}

export { useRoomChat };