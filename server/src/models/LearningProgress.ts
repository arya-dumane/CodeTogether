import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface LearningProgressShape {
  user: Types.ObjectId;
  learningPath: Types.ObjectId;
  completedLessons: Types.ObjectId[];
  enrolledAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LearningProgressDocument = HydratedDocument<LearningProgressShape>;

const learningProgressSchema = new Schema<LearningProgressShape>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    learningPath: { type: Schema.Types.ObjectId, ref: 'LearningPath', required: true },
    completedLessons: { type: [Schema.Types.ObjectId], default: [] },
    enrolledAt: { type: Date, required: true, default: Date.now },
    lastActivityAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

learningProgressSchema.index({ user: 1, learningPath: 1 }, { unique: true });
learningProgressSchema.index({ user: 1, lastActivityAt: -1 });

learningProgressSchema.set('toJSON', {
  transform: (_document, value) => {
    const output = value as unknown as Record<string, unknown>;
    delete output.__v;
    return output;
  },
});

export const LearningProgress = model<LearningProgressShape>(
  'LearningProgress',
  learningProgressSchema,
);
