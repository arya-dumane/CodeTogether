import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import type { LearningDifficulty, LessonType } from '../../lib/api/learningPaths';

const difficultyTones: Record<LearningDifficulty, 'success' | 'warning' | 'accent'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'accent',
};

const difficultyLabels: Record<LearningDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function DifficultyBadge({ difficulty }: { difficulty: LearningDifficulty }) {
  return <Badge tone={difficultyTones[difficulty]}>{difficultyLabels[difficulty]}</Badge>;
}

export function LessonTypeBadge({ type }: { type: LessonType }) {
  return (
    <Badge tone="outline">{type === 'exercise' ? 'Exercise' : 'Reading'}</Badge>
  );
}

export function CategoryBadge({ children }: { children: ReactNode }) {
  return <Badge tone="outline">{children}</Badge>;
}
