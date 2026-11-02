import { api } from './client';

export type LearningDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type LessonType = 'reading' | 'exercise';

export interface LearningPathSummary {
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

export interface LearningLesson {
  id: string;
  title: string;
  shortDescription: string;
  content: string;
  estimatedDurationMinutes: number;
  type: LessonType;
  position: number;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  position: number;
  lessons: LearningLesson[];
}

export interface LearningPath extends LearningPathSummary {
  detailedDescription: string;
  modules: LearningModule[];
}

export interface LearningProgress {
  pathId: string;
  enrolled: boolean;
  completedLessons: string[];
  completedCount: number;
  totalLessons: number;
  percentage: number;
  enrolledAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
}

export interface LearningProgressEntry {
  path: LearningPathSummary;
  progress: LearningProgress;
}

export async function fetchLearningPaths(): Promise<LearningPathSummary[]> {
  const data = await api.get<{ paths: LearningPathSummary[] }>('/learning-paths');
  return data.paths;
}

export async function fetchLearningPath(pathId: string): Promise<LearningPath> {
  const data = await api.get<{ path: LearningPath }>(`/learning-paths/${pathId}`);
  return data.path;
}

export async function fetchLearningProgress(pathId: string): Promise<LearningProgress> {
  const data = await api.get<{ progress: LearningProgress }>(
    `/learning-paths/${pathId}/progress`,
  );
  return data.progress;
}

export async function fetchMyLearningProgress(): Promise<LearningProgressEntry[]> {
  const data = await api.get<{ enrollments: LearningProgressEntry[] }>(
    '/learning-paths/progress',
  );
  return data.enrollments;
}

export async function enrollLearningPath(pathId: string): Promise<LearningProgress> {
  const data = await api.post<{ progress: LearningProgress }>(
    `/learning-paths/${pathId}/enroll`,
  );
  return data.progress;
}

export async function completeLearningLesson(
  pathId: string,
  lessonId: string,
): Promise<LearningProgress> {
  const data = await api.put<{ progress: LearningProgress }>(
    `/learning-paths/${pathId}/lessons/${lessonId}/complete`,
  );
  return data.progress;
}

export async function uncompleteLearningLesson(
  pathId: string,
  lessonId: string,
): Promise<LearningProgress> {
  const data = await api.delete<{ progress: LearningProgress }>(
    `/learning-paths/${pathId}/lessons/${lessonId}/complete`,
  );
  return data.progress;
}
