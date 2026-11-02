import { z } from 'zod';
import {
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_STATUSES,
} from '../models/Room.js';

const objectId = (label: string) =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label} ID`);

const roomId = objectId('room');
const roomName = z
  .string()
  .trim()
  .min(1, 'Room name is required')
  .max(ROOM_NAME_MAX_LENGTH, `Room name must be at most ${ROOM_NAME_MAX_LENGTH} characters`);
const roomDescription = z
  .string()
  .trim()
  .max(
    ROOM_DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${ROOM_DESCRIPTION_MAX_LENGTH} characters`,
  );
const optionalProjectId = objectId('project').nullable().optional();
const optionalLearningPathId = objectId('learning path').nullable().optional();
const emptyObject = z.object({}).strict();
const emptyBody = z.object({}).strict().optional();
const roomParams = z.object({ roomId }).strict();

export const listRoomsSchema = z.object({
  body: z.unknown(),
  params: emptyObject,
  query: emptyObject,
});

export const createRoomSchema = z.object({
  body: z
    .object({
      name: roomName,
      description: roomDescription.optional(),
      projectId: optionalProjectId,
      learningPathId: optionalLearningPathId,
    })
    .strict(),
  params: emptyObject,
  query: emptyObject,
});

export const roomIdSchema = z.object({
  body: z.unknown(),
  params: roomParams,
  query: emptyObject,
});

export const updateRoomSchema = z.object({
  body: z
    .object({
      name: roomName.optional(),
      description: roomDescription.optional(),
      status: z.enum(ROOM_STATUSES).optional(),
      projectId: optionalProjectId,
      learningPathId: optionalLearningPathId,
    })
    .strict()
    .refine(
      (value) =>
        value.name !== undefined ||
        value.description !== undefined ||
        value.status !== undefined ||
        value.projectId !== undefined ||
        value.learningPathId !== undefined,
      { message: 'Provide at least one field to update' },
    ),
  params: roomParams,
  query: emptyObject,
});

export const joinRoomSchema = z.object({
  body: z
    .object({
      inviteCode: z
        .string()
        .trim()
        .min(1, 'Invite code is required')
        .max(128, 'Invite code is too long'),
    })
    .strict(),
  params: emptyObject,
  query: emptyObject,
});

export const leaveRoomSchema = z.object({
  body: emptyBody,
  params: roomParams,
  query: emptyObject,
});

export const rotateInviteCodeSchema = z.object({
  body: emptyBody,
  params: roomParams,
  query: emptyObject,
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>['body'];
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>['body'];
export type JoinRoomInput = z.infer<typeof joinRoomSchema>['body'];
