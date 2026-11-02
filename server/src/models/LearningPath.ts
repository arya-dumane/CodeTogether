import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const LEARNING_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const LESSON_TYPES = ['reading', 'exercise'] as const;
export const LEARNING_PATH_STATUSES = ['draft', 'published'] as const;

export type LearningDifficulty = (typeof LEARNING_DIFFICULTIES)[number];
export type LessonType = (typeof LESSON_TYPES)[number];
export type LearningPathStatus = (typeof LEARNING_PATH_STATUSES)[number];

export interface LessonShape {
  _id: Types.ObjectId;
  title: string;
  shortDescription: string;
  content: string;
  estimatedDurationMinutes: number;
  type: LessonType;
  position: number;
}

export interface ModuleShape {
  _id: Types.ObjectId;
  title: string;
  description: string;
  position: number;
  lessons: LessonShape[];
}

export interface LearningPathShape {
  title: string;
  slug: string;
  shortDescription: string;
  detailedDescription: string;
  difficulty: LearningDifficulty;
  category: string;
  estimatedDurationMinutes: number;
  modules: ModuleShape[];
  status: LearningPathStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type LearningPathDocument = HydratedDocument<LearningPathShape>;

const lessonSchema = new Schema<LessonShape>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    shortDescription: { type: String, default: '', trim: true, maxlength: 500 },
    content: { type: String, default: '', maxlength: 20_000 },
    estimatedDurationMinutes: { type: Number, default: 0, min: 0, max: 100_000 },
    type: { type: String, enum: LESSON_TYPES, default: 'reading' },
    position: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const moduleSchema = new Schema<ModuleShape>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', trim: true, maxlength: 1_000 },
    position: { type: Number, required: true, min: 0 },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: true },
);

const learningPathSchema = new Schema<LearningPathShape>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    shortDescription: { type: String, required: true, trim: true, maxlength: 500 },
    detailedDescription: { type: String, required: true, trim: true, maxlength: 10_000 },
    difficulty: { type: String, enum: LEARNING_DIFFICULTIES, required: true },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    estimatedDurationMinutes: { type: Number, default: 0, min: 0, max: 100_000 },
    modules: { type: [moduleSchema], default: [] },
    status: { type: String, enum: LEARNING_PATH_STATUSES, default: 'draft' },
  },
  { timestamps: true },
);

learningPathSchema.index({ status: 1, title: 1 });

learningPathSchema.set('toJSON', {
  transform: (_document, value) => {
    const output = value as unknown as Record<string, unknown>;
    delete output.__v;
    return output;
  },
});

export const LearningPath = model<LearningPathShape>('LearningPath', learningPathSchema);

export interface PublicLesson {
  id: string;
  title: string;
  shortDescription: string;
  content: string;
  estimatedDurationMinutes: number;
  type: LessonType;
  position: number;
}

export interface PublicModule {
  id: string;
  title: string;
  description: string;
  position: number;
  lessons: PublicLesson[];
}

export interface PublicLearningPathSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  difficulty: LearningDifficulty;
  category: string;
  estimatedDurationMinutes: number;
  moduleCount: number;
  lessonCount: number;
}

export interface PublicLearningPath extends PublicLearningPathSummary {
  detailedDescription: string;
  modules: PublicModule[];
}

type PathLike = LearningPathShape & { _id: Types.ObjectId };

function asPathLike(path: LearningPathDocument | PathLike): PathLike {
  return path as unknown as PathLike;
}

export function orderedModules(path: LearningPathDocument | PathLike): ModuleShape[] {
  const record = asPathLike(path);
  return [...(record.modules ?? [])]
    .sort((first, second) => first.position - second.position)
    .map((module) => ({
      _id: module._id,
      title: module.title,
      description: module.description,
      position: module.position,
      lessons: [...(module.lessons ?? [])]
        .sort((first, second) => first.position - second.position)
        .map((lesson) => ({
          _id: lesson._id,
          title: lesson.title,
          shortDescription: lesson.shortDescription,
          content: lesson.content,
          estimatedDurationMinutes: lesson.estimatedDurationMinutes,
          type: lesson.type,
          position: lesson.position,
        })),
    }));
}

export function allLessons(
  path: LearningPathDocument | PathLike,
): Array<LessonShape & { moduleId: Types.ObjectId }> {
  return orderedModules(path).flatMap((module) =>
    module.lessons.map((lesson) => ({ ...lesson, moduleId: module._id })),
  );
}

export function lessonIds(path: LearningPathDocument | PathLike): string[] {
  return allLessons(path).map((lesson) => lesson._id.toString());
}

export function findLessonInPath(
  path: LearningPathDocument | PathLike,
  lessonId: string,
): (LessonShape & { moduleId: Types.ObjectId }) | null {
  return allLessons(path).find((lesson) => lesson._id.toString() === lessonId) ?? null;
}

function moduleCount(path: LearningPathDocument | PathLike): number {
  return orderedModules(path).length;
}

export function serializeLearningPathSummary(
  path: LearningPathDocument | PathLike,
): PublicLearningPathSummary {
  const record = asPathLike(path);
  const modules = orderedModules(path);

  return {
    id: record._id.toString(),
    slug: record.slug,
    title: record.title,
    shortDescription: record.shortDescription,
    difficulty: record.difficulty,
    category: record.category,
    estimatedDurationMinutes: record.estimatedDurationMinutes,
    moduleCount: moduleCount(path),
    lessonCount: modules.reduce((total, module) => total + module.lessons.length, 0),
  };
}

export function serializeLearningPath(
  path: LearningPathDocument | PathLike,
): PublicLearningPath {
  const record = asPathLike(path);

  return {
    ...serializeLearningPathSummary(path),
    detailedDescription: record.detailedDescription,
    modules: orderedModules(path).map((module) => ({
      id: module._id.toString(),
      title: module.title,
      description: module.description,
      position: module.position,
      lessons: module.lessons.map((lesson) => ({
        id: lesson._id.toString(),
        title: lesson.title,
        shortDescription: lesson.shortDescription,
        content: lesson.content,
        estimatedDurationMinutes: lesson.estimatedDurationMinutes,
        type: lesson.type,
        position: lesson.position,
      })),
    })),
  };
}
