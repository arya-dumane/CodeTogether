import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface RoomMessageShape {
  roomId: Types.ObjectId;
  projectId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  replyTo?: Types.ObjectId;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RoomMessageDocument = HydratedDocument<RoomMessageShape>;

const roomMessageSchema = new Schema<RoomMessageShape>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 10000,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'RoomMessage',
    },
    editedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for chronological pagination per room
roomMessageSchema.index({ roomId: 1, createdAt: -1 });
// Index for finding replies in a room
roomMessageSchema.index({ roomId: 1, replyTo: 1 });
// Index for finding non-deleted messages in a room
roomMessageSchema.index({ roomId: 1, deletedAt: 1 });

export const RoomMessage = model<RoomMessageShape>(
  'RoomMessage',
  roomMessageSchema
);