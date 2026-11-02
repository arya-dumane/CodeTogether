import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Clock } from 'lucide-react';
import type { LearningPathSummary, LearningProgress } from '../../lib/api/learningPaths';
import { formatDurationMinutes } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { CategoryBadge, DifficultyBadge } from './LearningPathBadges';
import { ProgressBar } from './ProgressBar';

interface LearningPathCardProps {
  path: LearningPathSummary;
  progress?: LearningProgress;
}

export function LearningPathCard({ path, progress }: LearningPathCardProps) {
  const enrolled = progress?.enrolled ?? false;
  const isComplete = enrolled && progress !== undefined && progress.percentage === 100;

  return (
    <Link
      to={`/dashboard/learning-paths/${path.id}`}
      className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={path.difficulty} />
        <CategoryBadge>{path.category}</CategoryBadge>
        {isComplete ? <Badge tone="success">Complete</Badge> : null}
      </div>

      <h2 className="mt-3 text-base font-semibold text-ink">{path.title}</h2>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
        {path.shortDescription}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDurationMinutes(path.estimatedDurationMinutes)}
        </span>
        <span>
          {path.moduleCount} modules · {path.lessonCount} lessons
        </span>
      </div>

      {enrolled && progress ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink-soft">
              {isComplete ? 'Path complete' : 'In progress'}
            </span>
            <span className="text-muted">
              {progress.completedCount}/{progress.totalLessons} · {progress.percentage}%
            </span>
          </div>
          <ProgressBar
            value={progress.percentage}
            label={`${path.title} progress`}
            className="mt-2"
          />
        </div>
      ) : null}
    </Link>
  );
}
