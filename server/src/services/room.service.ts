import { isDuplicateKeyError } from '../db/mongoErrors.js';
import { AppError, NotFoundError } from '../errors/AppError.js';
import { LearningPath } from '../models/LearningPath.js';
import { Project } from '../models/Project.js';
import {
  Room,
  generateInviteCode,
  serializeRoomSummary,
  type PublicLinkedLearningPath,
  type PublicLinkedProject,
  type PublicRoomDetail,
  type PublicRoomMember,
  type PublicRoomSummary,
  type RoomDocument,
} from '../models/Room.js';
import { User } from '../models/User.js';
import type { CreateRoomInput, UpdateRoomInput } from '../schemas/room.js';

const INVITE_CODE_ATTEMPTS = 5;

function roomNotFound(): NotFoundError {
  return new NotFoundError('Room not found');
}

function invalidProjectReference(): AppError {
  return new AppError(
    400,
    'INVALID_PROJECT_REFERENCE',
    'Linked project must be a project you own',
  );
}

function invalidLearningPathReference(): AppError {
  return new AppError(
    400,
    'INVALID_LEARNING_PATH_REFERENCE',
    'Linked learning path must be published',
  );
}

function ownerCannotLeave(): AppError {
  return new AppError(
    409,
    'OWNER_CANNOT_LEAVE',
    'Room owners must delete the room before leaving',
  );
}

function roomArchived(): AppError {
  return new AppError(409, 'ROOM_ARCHIVED', 'This room is archived and not accepting new members');
}

function inviteCodeUnavailable(): AppError {
  return new AppError(
    500,
    'INVITE_CODE_UNAVAILABLE',
    'A unique invite code could not be generated',
  );
}

async function assertProjectOwned(ownerId: string, projectId: string): Promise<void> {
  const project = await Project.findOne({ _id: projectId, owner: ownerId }).select('_id');

  if (!project) {
    throw invalidProjectReference();
  }
}

async function assertPublishedLearningPath(learningPathId: string): Promise<void> {
  const path = await LearningPath.findOne({
    _id: learningPathId,
    status: 'published',
  }).select('_id');

  if (!path) {
    throw invalidLearningPathReference();
  }
}

async function buildRoomDetail(viewerId: string, room: RoomDocument): Promise<PublicRoomDetail> {
  const memberIds = room.members.map((member) => member.user);
  const users = await User.find({ _id: { $in: memberIds } }).select('displayName');
  const displayNames = new Map(users.map((user) => [user._id.toString(), user.displayName]));

  const members: PublicRoomMember[] = [...room.members]
    .sort((first, second) => {
      const firstOwner = first.role === 'owner' ? 0 : 1;
      const secondOwner = second.role === 'owner' ? 0 : 1;

      if (firstOwner !== secondOwner) {
        return firstOwner - secondOwner;
      }

      return first.joinedAt.getTime() - second.joinedAt.getTime();
    })
    .map((member) => {
      const memberId = member.user.toString();

      return {
        userId: memberId,
        displayName: displayNames.get(memberId) ?? 'Former member',
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });

  let linkedProject: PublicLinkedProject | null = null;

  if (room.project && room.owner.toString() === viewerId) {
    const project = await Project.findOne({
      _id: room.project,
      owner: viewerId,
    }).select('name');

    if (project) {
      linkedProject = { id: project._id.toString(), name: project.name };
    }
  }

  let linkedLearningPath: PublicLinkedLearningPath | null = null;

  if (room.learningPath) {
    const path = await LearningPath.findOne({
      _id: room.learningPath,
      status: 'published',
    }).select('title slug');

    if (path) {
      linkedLearningPath = {
        id: path._id.toString(),
        title: path.title,
        slug: path.slug,
      };
    }
  }

  return {
    ...serializeRoomSummary(room, viewerId),
    inviteCode: room.inviteCode,
    members,
    linkedProject,
    linkedLearningPath,
  };
}

async function requireRoomMembership(userId: string, roomId: string): Promise<RoomDocument> {
  const room = await Room.findOne({ _id: roomId, 'members.user': userId });

  if (!room) {
    throw roomNotFound();
  }

  return room;
}

export async function requireActiveRoomMembership(userId: string, roomId: string): Promise<void> {
  const room = await Room.findOne({ _id: roomId, 'members.user': userId }).select('_id status');

  if (!room) {
    throw roomNotFound();
  }

  if (room.status === 'archived') {
    throw roomArchived();
  }
}

export async function getRoomPresenceAccess(
  userId: string,
  roomId: string,
): Promise<{ displayName: string }> {
  await requireActiveRoomMembership(userId, roomId);

  const user = await User.findById(userId).select('displayName');

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  return { displayName: user.displayName };
}

export async function listRooms(userId: string): Promise<PublicRoomSummary[]> {
  const rooms = await Room.find({ 'members.user': userId }).sort({
    updatedAt: -1,
    _id: -1,
  });

  return rooms.map((room) => serializeRoomSummary(room, userId));
}

export async function createRoom(
  ownerId: string,
  input: CreateRoomInput,
): Promise<PublicRoomDetail> {
  const projectId = input.projectId ?? null;
  const learningPathId = input.learningPathId ?? null;

  if (projectId) {
    await assertProjectOwned(ownerId, projectId);
  }

  if (learningPathId) {
    await assertPublishedLearningPath(learningPathId);
  }

  const now = new Date();
  let room: RoomDocument | null = null;

  for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt += 1) {
    try {
      room = await Room.create({
        name: input.name,
        description: input.description ?? '',
        inviteCode: generateInviteCode(),
        owner: ownerId,
        members: [{ user: ownerId, role: 'owner', joinedAt: now }],
        status: 'active',
        project: projectId,
        learningPath: learningPathId,
      });
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === INVITE_CODE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  if (!room) {
    throw inviteCodeUnavailable();
  }

  return buildRoomDetail(ownerId, room);
}

export async function getRoomDetail(
  userId: string,
  roomId: string,
): Promise<PublicRoomDetail> {
  const room = await requireRoomMembership(userId, roomId);
  return buildRoomDetail(userId, room);
}

export async function updateRoom(
  ownerId: string,
  roomId: string,
  input: UpdateRoomInput,
): Promise<PublicRoomDetail> {
  const owned = await Room.findOne({ _id: roomId, owner: ownerId }).select('_id');

  if (!owned) {
    throw roomNotFound();
  }

  const updates: Record<string, string | null> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.description !== undefined) {
    updates.description = input.description;
  }

  if (input.status !== undefined) {
    updates.status = input.status;
  }

  if (input.projectId !== undefined) {
    if (input.projectId) {
      await assertProjectOwned(ownerId, input.projectId);
    }

    updates.project = input.projectId ?? null;
  }

  if (input.learningPathId !== undefined) {
    if (input.learningPathId) {
      await assertPublishedLearningPath(input.learningPathId);
    }

    updates.learningPath = input.learningPathId ?? null;
  }

  const room = await Room.findOneAndUpdate(
    { _id: roomId, owner: ownerId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!room) {
    throw roomNotFound();
  }

  return buildRoomDetail(ownerId, room);
}

export async function deleteRoom(ownerId: string, roomId: string): Promise<void> {
  const room = await Room.findOneAndDelete({ _id: roomId, owner: ownerId });

  if (!room) {
    throw roomNotFound();
  }
}

export async function joinRoom(
  userId: string,
  inviteCode: string,
): Promise<{ room: PublicRoomDetail; alreadyMember: boolean }> {
  const room = await Room.findOne({ inviteCode });

  if (!room) {
    throw roomNotFound();
  }

  if (room.status === 'archived') {
    throw roomArchived();
  }

  if (room.members.some((member) => member.user.toString() === userId)) {
    return { room: await buildRoomDetail(userId, room), alreadyMember: true };
  }

  const joinedAt = new Date();
  const updated = await Room.findOneAndUpdate(
    {
      _id: room._id,
      status: 'active',
      'members.user': { $ne: userId },
    },
    { $push: { members: { user: userId, role: 'member', joinedAt } } },
    { new: true, runValidators: true },
  );

  if (updated) {
    return { room: await buildRoomDetail(userId, updated), alreadyMember: false };
  }

  const current = await Room.findById(room._id);

  if (!current) {
    throw roomNotFound();
  }

  if (current.status === 'archived') {
    throw roomArchived();
  }

  if (current.members.some((member) => member.user.toString() === userId)) {
    return { room: await buildRoomDetail(userId, current), alreadyMember: true };
  }

  throw new AppError(409, 'ROOM_JOIN_CONFLICT', 'Room membership changed. Please try again.');
}

export async function leaveRoom(userId: string, roomId: string): Promise<void> {
  const room = await requireRoomMembership(userId, roomId);

  if (room.owner.toString() === userId) {
    throw ownerCannotLeave();
  }

  const updated = await Room.findOneAndUpdate(
    { _id: roomId, 'members.user': userId, owner: { $ne: userId } },
    { $pull: { members: { user: userId } } },
    { new: true, runValidators: true },
  );

  if (updated) {
    return;
  }

  const current = await requireRoomMembership(userId, roomId);

  if (current.owner.toString() === userId) {
    throw ownerCannotLeave();
  }

  throw new AppError(409, 'ROOM_LEAVE_CONFLICT', 'Room membership changed. Please try again.');
}

export async function rotateInviteCode(
  ownerId: string,
  roomId: string,
): Promise<PublicRoomDetail> {
  for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt += 1) {
    const inviteCode = generateInviteCode();

    try {
      const room = await Room.findOneAndUpdate(
        { _id: roomId, owner: ownerId },
        { $set: { inviteCode } },
        { new: true, runValidators: true },
      );

      if (!room) {
        throw roomNotFound();
      }

      return buildRoomDetail(ownerId, room);
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === INVITE_CODE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw inviteCodeUnavailable();
}
