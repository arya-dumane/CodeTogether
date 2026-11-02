import { randomBytes } from 'node:crypto';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const ROOM_NAME_MAX_LENGTH = 120;
export const ROOM_DESCRIPTION_MAX_LENGTH = 2000;
export const ROOM_INVITE_CODE_MAX_LENGTH = 64;

export const ROOM_STATUSES = ['active', 'archived'] as const;
export const ROOM_MEMBER_ROLES = ['owner', 'member'] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type RoomMemberRole = (typeof ROOM_MEMBER_ROLES)[number];

export interface RoomMemberShape {
  user: Types.ObjectId;
  role: RoomMemberRole;
  joinedAt: Date;
}

export interface RoomShape {
  name: string;
  description: string;
  inviteCode: string;
  owner: Types.ObjectId;
  members: RoomMemberShape[];
  status: RoomStatus;
  project: Types.ObjectId | null;
  learningPath: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RoomDocument = HydratedDocument<RoomShape>;

const roomMemberSchema = new Schema<RoomMemberShape>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROOM_MEMBER_ROLES, required: true, default: 'member' },
    joinedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const roomSchema = new Schema<RoomShape>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: ROOM_NAME_MAX_LENGTH,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: ROOM_DESCRIPTION_MAX_LENGTH,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      maxlength: ROOM_INVITE_CODE_MAX_LENGTH,
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [roomMemberSchema], default: [] },
    status: { type: String, enum: ROOM_STATUSES, default: 'active', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    learningPath: { type: Schema.Types.ObjectId, ref: 'LearningPath', default: null },
  },
  { timestamps: true },
);

roomSchema.index({ 'members.user': 1, updatedAt: -1 });

roomSchema.pre('validate', function validateMembership(next) {
  const ownerId = this.owner?.toString();
  const memberIds = new Set<string>();

  for (const member of this.members) {
    const memberId = member.user?.toString();

    if (!memberId || memberIds.has(memberId)) {
      this.invalidate('members', 'Room members must be unique');
      return next();
    }

    memberIds.add(memberId);
  }

  if (!ownerId || !memberIds.has(ownerId)) {
    this.invalidate('members', 'Room owner must be a member');
    return next();
  }

  const ownerMembers = this.members.filter((member) => member.user.toString() === ownerId);
  const ownerRoleMembers = this.members.filter((member) => member.role === 'owner');

  if (ownerMembers.length !== 1 || ownerRoleMembers.length !== 1) {
    this.invalidate('members', 'Room owner must be the only owner-role member');
  }

  next();
});

roomSchema.set('toJSON', {
  transform: (_document, value) => {
    const output = value as unknown as Record<string, unknown>;
    delete output.__v;
    return output;
  },
});

export const Room = model<RoomShape>('Room', roomSchema);

export function generateInviteCode(): string {
  return randomBytes(16).toString('hex');
}

interface RoomLike {
  _id: Types.ObjectId;
  name: string;
  description: string;
  inviteCode: string;
  owner: Types.ObjectId;
  members: Array<{ user: Types.ObjectId; role: RoomMemberRole; joinedAt: Date }>;
  status: RoomStatus;
  project: Types.ObjectId | null;
  learningPath: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRoomSummary {
  id: string;
  name: string;
  description: string;
  status: RoomStatus;
  ownerId: string;
  memberCount: number;
  viewerRole: RoomMemberRole;
  hasLinkedProject: boolean;
  hasLinkedLearningPath: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRoomMember {
  userId: string;
  displayName: string;
  role: RoomMemberRole;
  joinedAt: Date;
}

export interface PublicLinkedProject {
  id: string;
  name: string;
}

export interface PublicLinkedLearningPath {
  id: string;
  title: string;
  slug: string;
}

export interface PublicRoomDetail extends PublicRoomSummary {
  inviteCode: string;
  members: PublicRoomMember[];
  linkedProject: PublicLinkedProject | null;
  linkedLearningPath: PublicLinkedLearningPath | null;
}

export function serializeRoomSummary(
  room: RoomDocument | RoomLike,
  viewerId: string,
): PublicRoomSummary {
  return {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    status: room.status,
    ownerId: room.owner.toString(),
    memberCount: room.members.length,
    viewerRole: room.owner.toString() === viewerId ? 'owner' : 'member',
    hasLinkedProject: Boolean(room.project),
    hasLinkedLearningPath: Boolean(room.learningPath),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
