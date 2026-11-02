import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, RefreshCw } from 'lucide-react';
import { useMyLearningProgress } from '../../hooks/useLearningPaths';
import { formatDateTime } from '../../lib/format';
import { Button, buttonClasses } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';
import { ProgressBar } from '../learning-paths/ProgressBar';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function LearningProgressCard() {
  const { enrollments, error, isLoading, refetch } = useMyLearningProgress();

  const completedLessons = enrollments.reduce(
    (total, entry) => total + entry.progress.completedCount,
    0,
  );
  const completedPaths = enrollments.filter(
    (entry) => entry.progress.totalLessons > 0 && entry.progress.percentage === 100,
  ).length;
  const averageProgress =
    enrollments.length === 0
      ? 0
      : Math.round(
          enrollments.reduce((total, entry) => total + entry.progress.percentage, 0) /
            enrollments.length,
        );

  return (
    <section
      className="rounded-lg border border-line bg-surface p-6"
      aria-labelledby="learning-progress-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="learning-progress-heading" className="text-base font-semibold text-ink">
              Learning progress
            </h2>
            <p className="mt-1 text-sm text-muted">
              Live progress from the learning paths you are enrolled in.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw
              className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Link to="/dashboard/learning-paths" className={buttonClasses('secondary', 'sm')}>
            Browse paths
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5">
          <Spinner label="Loading learning progress..." />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-5">
          <ErrorState title="Progress unavailable" message={error} onRetry={refetch} />
        </div>
      ) : null}

      {!isLoading && !error && enrollments.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={BookOpen}
            title="No learning paths started"
            description="Enroll in a curated path to begin tracking modules, lessons, and completion."
            action={
              <Link to="/dashboard/learning-paths" className={buttonClasses('primary', 'sm')}>
                Explore learning paths
              </Link>
            }
          />
        </div>
      ) : null}

      {!isLoading && !error && enrollments.length > 0 ? (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Enrolled paths" value={enrollments.length} />
            <Stat label="Lessons completed" value={completedLessons} />
            <Stat
              label="Average progress"
              value={`${averageProgress}%${completedPaths > 0 ? ` · ${completedPaths} complete` : ''}`}
            />
          </dl>

          <ul className="mt-5 space-y-3">
            {enrollments.slice(0, 4).map(({ path, progress }) => (
              <li key={path.id}>
                <Link
                  to={`/dashboard/learning-paths/${path.id}`}
                  className="block rounded-md border border-line px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{path.title}</span>
                    <span className="text-xs text-muted">
                      {progress.completedCount}/{progress.totalLessons} · {progress.percentage}%
                    </span>
                  </div>
                  <ProgressBar
                    value={progress.percentage}
                    label={`${path.title} progress`}
                    className="mt-2.5"
                  />
                  {progress.lastActivityAt ? (
                    <p className="mt-2 text-xs text-muted">
                      Last activity {formatDateTime(progress.lastActivityAt)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
