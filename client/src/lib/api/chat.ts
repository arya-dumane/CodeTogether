import { api } from './client';

export interface MessageSummary {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  replyTo?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface MessageDetail extends MessageSummary {
  senderName: string;
}

export interface MessageFormValues {
  content: string;
  replyTo?: string;
}

export async function fetchMessages(
  roomId: string,
  page = 1,
  limit = 50,
): Promise<{
  messages: MessageSummary[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const data = await api.get<{
    messages: MessageSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/api/v1/rooms/${roomId}/messages?page=${page}&limit=${limit}`);
  return data;
}

export async function sendMessage(
  roomId: string,
  content: string,
  replyTo?: string,
): Promise<{ messageId: string }> {
  const data = await api.post<{ messageId: string }>(
    `/api/v1/rooms/${roomId}/messages`,
    { content, replyTo },
  );
  return data;
}

export async function editMessage(
  messageId: string,
  content: string,
): Promise<{ messageId: string; editedAt: string }> {
  const data = await api.patch<{ messageId: string; editedAt: string }>(
    `/api/v1/rooms/messages/${messageId}`,
    { content },
  );
  return data;
}

export async function deleteMessage(
  messageId: string,
): Promise<{ success: boolean }> {
  const data = await api.delete<{ success: boolean }>(
    `/api/v1/rooms/messages/${messageId}`,
  );
  return data;
}