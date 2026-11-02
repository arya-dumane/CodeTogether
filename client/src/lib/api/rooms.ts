import { api } from './client';

export const ROOM_NAME_MAX_LENGTH = 120;
export const ROOM_DESCRIPTION_MAX_LENGTH = 2000;

export type RoomStatus = 'active' | 'archived';
export type RoomMemberRole = 'owner' | 'member';

export interface RoomSummary {
  id: string;
  name: string;
  description: string;
  status: RoomStatus;
  ownerId: string;
  memberCount: number;
  viewerRole: RoomMemberRole;
  hasLinkedProject: boolean;
  hasLinkedLearningPath: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  role: RoomMemberRole;
  joinedAt: string;
}

export interface LinkedProject {
  id: string;
  name: string;
}

export interface LinkedLearningPath {
  id: string;
  title: string;
  slug: string;
}

export interface RoomDetail extends RoomSummary {
  inviteCode: string;
  members: RoomMember[];
  linkedProject: LinkedProject | null;
  linkedLearningPath: LinkedLearningPath | null;
}

export interface RoomInput {
  name: string;
  description?: string;
  projectId?: string | null;
  learningPathId?: string | null;
}

export interface RoomUpdateInput extends RoomInput {
  status?: RoomStatus;
}

export interface JoinRoomResult {
  room: RoomDetail;
  alreadyMember: boolean;
}

export async function fetchRooms(): Promise<RoomSummary[]> {
  const data = await api.get<{ rooms: RoomSummary[] }>('/rooms');
  return data.rooms;
}

export async function fetchRoom(roomId: string): Promise<RoomDetail> {
  const data = await api.get<{ room: RoomDetail }>(`/rooms/${roomId}`);
  return data.room;
}

export async function createRoom(input: RoomInput): Promise<RoomDetail> {
  const data = await api.post<{ room: RoomDetail }>('/rooms', input);
  return data.room;
}

export async function updateRoom(
  roomId: string,
  input: Partial<RoomUpdateInput>,
): Promise<RoomDetail> {
  const data = await api.patch<{ room: RoomDetail }>(`/rooms/${roomId}`, input);
  return data.room;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await api.delete<void>(`/rooms/${roomId}`);
}

export async function joinRoom(inviteCode: string): Promise<JoinRoomResult> {
  return api.post<JoinRoomResult>('/rooms/join', { inviteCode });
}

export async function leaveRoom(roomId: string): Promise<void> {
  await api.post<void>(`/rooms/${roomId}/leave`);
}

export async function rotateRoomInviteCode(roomId: string): Promise<RoomDetail> {
  const data = await api.post<{ room: RoomDetail }>(`/rooms/${roomId}/invite-code/rotate`);
  return data.room;
}
