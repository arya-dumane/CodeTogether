import type { Types } from 'mongoose';
import { isDuplicateKeyError } from '../db/mongoErrors.js';
import { AppError, NotFoundError } from '../errors/AppError.js';
import {
  LearningPath,
  findLessonInPath,
  lessonIds,
  serializeLearningPath,
  serializeLearningPathSummary,
  type LearningPathDocument,
  type PublicLearningPath,
  type PublicLearningPathSummary,
} from '../models/LearningPath.js';
import {
  LearningProgress,
  type LearningProgressDocument,
} from '../models/LearningProgress.js';

export interface ProgressView {
  pathId: string;
  enrolled: boolean;
  completedLessons: string[];
  completedCount: number;
  totalLessons: number;
  percentage: number;
  enrolledAt: Date | null;
  lastActivityAt: Date | null;
  completedAt: Date | null;
}

export interface LearningProgressEntry {
  path: PublicLearningPathSummary;
  progress: ProgressView;
}

function pathNotFound(): NotFoundError {
  return new NotFoundError('Learning path not found');
}

function lessonNotFound(): NotFoundError {
  return new NotFoundError('Lesson not found in this learning path');
}

function notEnrolled(): AppError {
  return new AppError(409, 'NOT_ENROLLED', 'Enroll in this learning path first');
}

async function findPublishedPath(pathId: string): Promise<LearningPathDocument> {
  const path = await LearningPath.findOne({ _id: pathId, status: 'published' });

  if (!path) {
    throw pathNotFound();
  }

  return path;
}

function validCompletedLessonIds(
  path: LearningPathDocument,
  completedLessons: Types.ObjectId[],
): string[] {
  const validIds = new Set(lessonIds(path));
  const completed = new Set<string>();

  for (const lessonId of completedLessons) {
    const value = lessonId.toString();
    if (validIds.has(value)) {
      completed.add(value);
    }
  }

  return [...completed];
}

export function buildProgressView(
  path: LearningPathDocument,
  progress: LearningProgressDocument | null,
): ProgressView {
  const totalLessons = lessonIds(path).length;
  const completedLessons = progress
    ? validCompletedLessonIds(path, progress.completedLessons)
    : [];
  const completedCount = completedLessons.length;
  const percentage =
    totalLessons === 0
      ? 0
      : Math.min(100, Math.round((completedCount / totalLessons) * 100));

  return {
    pathId: path._id.toString(),
    enrolled: progress !== null,
    completedLessons,
    completedCount,
    totalLessons,
    percentage,
    enrolledAt: progress?.enrolledAt ?? null,
    lastActivityAt: progress?.lastActivityAt ?? null,
    completedAt: progress?.completedAt ?? null,
  };
}

export async function listPublishedLearningPaths(): Promise<PublicLearningPathSummary[]> {
  const paths = await LearningPath.find({ status: 'published' }).sort({
    title: 1,
    _id: 1,
  });

  return paths.map(serializeLearningPathSummary);
}

export async function getPublishedLearningPath(pathId: string): Promise<PublicLearningPath> {
  const path = await findPublishedPath(pathId);
  return serializeLearningPath(path);
}

export async function enrollInLearningPath(
  userId: string,
  pathId: string,
): Promise<{ progress: ProgressView; created: boolean }> {
  const path = await findPublishedPath(pathId);
  const existing = await LearningProgress.findOne({
    user: userId,
    learningPath: path._id,
  });

  if (existing) {
    return { progress: buildProgressView(path, existing), created: false };
  }

  try {
    const now = new Date();
    const progress = await LearningProgress.create({
      user: userId,
      learningPath: path._id,
      completedLessons: [],
      enrolledAt: now,
      lastActivityAt: now,
      completedAt: null,
    });

    return { progress: buildProgressView(path, progress), created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const concurrent = await LearningProgress.findOne({
      user: userId,
      learningPath: path._id,
    });

    if (!concurrent) {
      throw error;
    }

    return { progress: buildProgressView(path, concurrent), created: false };
  }
}

export async function getUserProgress(
  userId: string,
  pathId: string,
): Promise<ProgressView> {
  const path = await findPublishedPath(pathId);
  const progress = await LearningProgress.findOne({
    user: userId,
    learningPath: path._id,
  });

  return buildProgressView(path, progress);
}

async function syncCompletion(
  path: LearningPathDocument,
  progress: LearningProgressDocument,
): Promise<LearningProgressDocument> {
  const view = buildProgressView(path, progress);
  const isComplete = view.totalLessons > 0 && view.completedCount === view.totalLessons;

  if (isComplete && !progress.completedAt) {
    progress.completedAt = new Date();
    await progress.save();
  } else if (!isComplete && progress.completedAt) {
    progress.completedAt = null;
    await progress.save();
  }

  return progress;
}

async function requireProgress(
  userId: string,
  path: LearningPathDocument,
): Promise<LearningProgressDocument> {
  const progress = await LearningProgress.findOne({
    user: userId,
    learningPath: path._id,
  });

  if (!progress) {
    throw notEnrolled();
  }

  return progress;
}

export async function completeLesson(
  userId: string,
  pathId: string,
  lessonId: string,
): Promise<ProgressView> {
  const path = await findPublishedPath(pathId);
  const lesson = findLessonInPath(path, lessonId);

  if (!lesson) {
    throw lessonNotFound();
  }

  const enrolled = await requireProgress(userId, path);

  const progress = await LearningProgress.findOneAndUpdate(
    { _id: enrolled._id, user: userId, learningPath: path._id },
    {
      $addToSet: { completedLessons: lesson._id },
      $set: { lastActivityAt: new Date() },
    },
    { new: true, runValidators: true },
  );

  if (!progress) {
    throw notEnrolled();
  }

  await syncCompletion(path, progress);
  return buildProgressView(path, progress);
}

export async function uncompleteLesson(
  userId: string,
  pathId: string,
  lessonId: string,
): Promise<ProgressView> {
  const path = await findPublishedPath(pathId);
  const lesson = findLessonInPath(path, lessonId);

  if (!lesson) {
    throw lessonNotFound();
  }

  const enrolled = await requireProgress(userId, path);

  const progress = await LearningProgress.findOneAndUpdate(
    { _id: enrolled._id, user: userId, learningPath: path._id },
    {
      $pull: { completedLessons: lesson._id },
      $set: { lastActivityAt: new Date() },
    },
    { new: true, runValidators: true },
  );

  if (!progress) {
    throw notEnrolled();
  }

  await syncCompletion(path, progress);
  return buildProgressView(path, progress);
}

export async function listUserProgress(userId: string): Promise<LearningProgressEntry[]> {
  const progressRecords = await LearningProgress.find({ user: userId }).sort({
    lastActivityAt: -1,
    _id: -1,
  });

  if (progressRecords.length === 0) {
    return [];
  }

  const paths = await LearningPath.find({
    _id: { $in: progressRecords.map((record) => record.learningPath) },
    status: 'published',
  });

  const pathsById = new Map(paths.map((path) => [path._id.toString(), path]));
  const entries: LearningProgressEntry[] = [];

  for (const record of progressRecords) {
    const path = pathsById.get(record.learningPath.toString());

    if (!path) {
      continue;
    }

    entries.push({
      path: serializeLearningPathSummary(path),
      progress: buildProgressView(path, record),
    });
  }

  return entries;
}
