import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface DocumentVersionShape {
  projectId: Types.ObjectId;
  roomId: string;
  documentId: string;
  versionNumber: number;
  snapshot: Buffer; // serialized Yjs document state
  createdBy: Types.ObjectId;
  createdAt: Date;
  description?: string;
  type: 'automatic' | 'manual' | 'restore';
  metadata?: Record<string, unknown>;
}

export type DocumentVersionDocument = HydratedDocument<DocumentVersionShape>;

const documentVersionSchema = new Schema<DocumentVersionShape>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    roomId: {
      type: String,
      required: true,
    },
    documentId: {
      type: String,
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    snapshot: {
      type: Buffer,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ['automatic', 'manual', 'restore'],
      default: 'automatic',
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Index for finding versions by room and document, ordered by version number
documentVersionSchema.index(
  { roomId: 1, documentId: 1, versionNumber: 1 },
  { unique: false }
);

// Index for finding versions by type and room
documentVersionSchema.index({ type: 1, roomId: 1, documentId: 1 });

// Index for recent versions query
documentVersionSchema.index({ createdAt: -1 });

export const DocumentVersion = model<DocumentVersionShape>(
  'DocumentVersion',
  documentVersionSchema,
);