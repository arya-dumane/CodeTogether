
import { Schema, model } from 'mongoose';

const collaborativeDocumentSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
    },
    documentId: {
      type: String,
      required: true,
    },
    state: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

collaborativeDocumentSchema.index(
  { roomId: 1, documentId: 1 },
  { unique: true },
);

export const CollaborativeDocument = model(
  'CollaborativeDocument',
  collaborativeDocumentSchema,
);
