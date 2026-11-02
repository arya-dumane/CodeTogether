import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Loader2,
} from 'lucide-react';
import { ProgressBar } from '../components/learning-paths/ProgressBar';
import {
  CategoryBadge,
  DifficultyBadge,
  LessonTypeBadge,
} from '../components/learning-paths/LearningPathBadges';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useLearningPath } from '../hooks/useLearningPaths';
import { errorMessage } from '../lib/api/errors';
import {
  completeLearningLesson,
  enrollLearningPath,
  uncompleteLearningLesson,
  type LearningLesson,
} from '../lib/api/learningPaths';
import { cn } from '../lib/cn';
import { formatDateTime, formatDurationMinutes } from '../lib/format';

interface FlatLesson extends LearningLesson {
  moduleId: string;
  moduleTitle: string;
}

export function LearningPathDetailPage() {
  const { pathId = '' } = useParams<{ pathId: string }>();
  const { path, progress, error, isLoading, refetch, replaceProgress } =
    useLearningPath(pathId);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [mutatingLessonId, setMutatingLessonId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const flatLessons = useMemo<FlatLesson[]>(
    () =>
      path
        ? path.modules.flatMap((module) =>
            module.lessons.map((lesson) => ({
              ...lesson,
              moduleId: module.id,
              moduleTitle: module.title,
            })),
          )
        : [],
    [path],
  );

  const completedLessonIds = progress?.completedLessons;

  useEffect(() => {
    if (!path) return;

    if (flatLessons.length === 0) {
      setSelectedLessonId(null);
      return;
    }

    setSelectedLessonId((current) => {
      if (current && flatLessons.some((lesson) => lesson.id === current)) {
        return current;
      }

      const completed = new Set(completedLessonIds ?? []);
      const nextLesson =
        flatLessons.find((lesson) => !completed.has(lesson.id)) ?? flatLessons[0];

      return nextLesson?.id ?? null;
    });
  }, [path, flatLessons, completedLessonIds]);

  useEffect(() => {
    if (!path || path.modules.length === 0) return;

    setOpenModules((current) => {
      if (current.length > 0) return current;
      const firstModule = path.modules[0];
      return firstModule ? [firstModule.id] : [];
    });
  }, [path]);

  const selectedLesson =
    flatLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  useEffect(() => {
    if (!selectedLesson) return;

    setOpenModules((current) =>
      current.includes(selectedLesson.moduleId)
        ? current
        : [...current, selectedLesson.moduleId],
    );
  }, [selectedLesson?.id, selectedLesson?.moduleId]);

  const completedSet = useMemo(
    () => new Set(progress?.completedLessons ?? []),
    [progress?.completedLessons],
  );

  const isEnrolled = progress?.enrolled ?? false;
  const completedCount = progress?.completedCount ?? 0;
  const totalLessons = progress?.totalLessons ?? flatLessons.length;
  const percentage = progress?.percentage ?? 0;
  const isComplete = isEnrolled && totalLessons > 0 && completedCount === totalLessons;

  const toggleModule = (moduleId: string) => {
    setOpenModules((current) =>
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId],
    );
  };

  const selectLesson = (lesson: FlatLesson) => {
    setSelectedLessonId(lesson.id);
    setActionError(null);
    setSuccess(null);
    setOpenModules((current) =>
      current.includes(lesson.moduleId) ? current : [...current, lesson.moduleId],
    );
  };

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setActionError(null);
    setSuccess(null);

    try {
      const updated = await enrollLearningPath(pathId);
      replaceProgress(updated);
      setSuccess('You are enrolled. Your progress will update as you complete lessons.');
    } catch (enrollmentError) {
      setActionError(
        errorMessage(enrollmentError, 'Enrollment could not be completed. Please try again.'),
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleToggleLesson = async (lesson: FlatLesson) => {
    if (!isEnrolled) {
      setActionError('Enroll in this path before marking lessons complete.');
      return;
    }

    const wasCompleted = completedSet.has(lesson.id);
    setMutatingLessonId(lesson.id);
    setActionError(null);
    setSuccess(null);

    try {
      const updated = wasCompleted
        ? await uncompleteLearningLesson(pathId, lesson.id)
        : await completeLearningLesson(pathId, lesson.id);

      replaceProgress(updated);

      if (!wasCompleted && updated.completedAt) {
        setSuccess('All lessons complete. Nice work!');
      } else if (wasCompleted) {
        setSuccess('Lesson marked incomplete.');
      } else {
        setSuccess('Lesson marked complete.');
      }
    } catch (mutationError) {
      setActionError(
        errorMessage(mutationError, 'Your progress could not be updated. Please try again.'),
      );
    } finally {
      setMutatingLessonId(null);
    }
  };

  const backLink = (
    <Link
      to="/dashboard/learning-paths"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All learning paths
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <Spinner label="Loading learning path..." />
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="space-y-6">
        {backLink}
        <ErrorState
          title="Learning path unavailable"
          message={error ?? 'This learning path could not be found.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backLink}

      <PageHeader
        title={path.title}
        description={path.detailedDescription || path.shortDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={path.difficulty} />
            <CategoryBadge>{path.category}</CategoryBadge>
            <Badge tone="outline">{formatDurationMinutes(path.estimatedDurationMinutes)}</Badge>
          </div>
        }
      />

      {success ? <Notice tone="success">{success}</Notice> : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}

      <section
        className="rounded-lg border border-line bg-surface p-6"
        aria-labelledby="path-progress-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="path-progress-heading" className="text-base font-semibold text-ink">
              Your progress
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isEnrolled
                ? `${completedCount} of ${totalLessons} lessons complete across ${path.moduleCount} modules.`
                : 'Enroll to track completed lessons and keep your progress across sessions.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums text-ink">{percentage}%</span>
            {isComplete ? (
              <Badge tone="success">Path complete</Badge>
            ) : isEnrolled ? (
              <Badge tone="neutral">In progress</Badge>
            ) : (
              <Badge tone="outline">Not enrolled</Badge>
            )}
          </div>
        </div>

        <ProgressBar value={percentage} label="Path progress" className="mt-4" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {isEnrolled && progress?.lastActivityAt ? (
              <span>Last activity {formatDateTime(progress.lastActivityAt)}</span>
            ) : (
              <span>
                {path.lessonCount} lessons · {formatDurationMinutes(path.estimatedDurationMinutes)}{' '}
                estimated
              </span>
            )}
          </div>

          {!isEnrolled ? (
            <Button onClick={() => void handleEnroll()} disabled={isEnrolling}>
              {isEnrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              )}
              {isEnrolling ? 'Enrolling...' : 'Enroll to start'}
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <nav
          className="rounded-lg border border-line bg-surface p-3"
          aria-label="Learning path modules"
        >
          {path.modules.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">This path has no modules yet.</p>
          ) : (
            <ul className="space-y-2">
              {path.modules.map((module) => {
                const isOpen = openModules.includes(module.id);
                const moduleCompletedCount = module.lessons.filter((lesson) =>
                  completedSet.has(lesson.id),
                ).length;

                return (
                  <li key={module.id}>
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      aria-expanded={isOpen}
                      aria-controls={`module-${module.id}`}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted transition-transform',
                          isOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                        {module.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {moduleCompletedCount}/{module.lessons.length}
                      </span>
                    </button>

                    {isOpen ? (
                      <div id={`module-${module.id}`} className="mt-1 pl-6">
                        {module.description ? (
                          <p className="px-2 pb-2 text-xs leading-relaxed text-muted">
                            {module.description}
                          </p>
                        ) : null}
                        {module.lessons.length === 0 ? (
                          <p className="px-2 pb-2 text-xs text-muted">No lessons in this module.</p>
                        ) : (
                          <ul className="space-y-1 border-l border-line pl-3">
                            {module.lessons.map((lesson) => {
                              const isSelected = lesson.id === selectedLessonId;
                              const isDone = completedSet.has(lesson.id);

                              return (
                                <li key={lesson.id}>
                                  <button
                                    type="button"
                                    onClick={() => selectLesson({ ...lesson, moduleId: module.id, moduleTitle: module.title })}
                                    aria-current={isSelected ? 'true' : undefined}
                                    className={cn(
                                      'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                      isSelected
                                        ? 'bg-primary-soft/70 font-medium text-ink'
                                        : 'text-ink-soft hover:bg-primary-soft/30',
                                    )}
                                  >
                                    {isDone ? (
                                      <CheckCircle2
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Circle
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/60"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="min-w-0 flex-1 leading-relaxed">
                                      {lesson.title}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <section
          className="min-w-0 rounded-lg border border-line bg-surface p-6"
          aria-labelledby="lesson-heading"
        >
          {selectedLesson ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">{selectedLesson.moduleTitle}</span>
                <LessonTypeBadge type={selectedLesson.type} />
                <Badge tone="outline">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatDurationMinutes(selectedLesson.estimatedDurationMinutes)}
                </Badge>
                {completedSet.has(selectedLesson.id) ? (
                  <Badge tone="success">Completed</Badge>
                ) : null}
              </div>

              <h2 id="lesson-heading" className="mt-3 text-xl font-semibold text-ink">
                {selectedLesson.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {selectedLesson.shortDescription}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-line py-4">
                <Button
                  variant={completedSet.has(selectedLesson.id) ? 'secondary' : 'primary'}
                  onClick={() => void handleToggleLesson(selectedLesson)}
                  disabled={!isEnrolled || mutatingLessonId !== null}
                  title={isEnrolled ? undefined : 'Enroll in this path to track completion'}
                >
                  {mutatingLessonId === selectedLesson.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : completedSet.has(selectedLesson.id) ? (
                    <Circle className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {completedSet.has(selectedLesson.id) ? 'Mark incomplete' : 'Mark complete'}
                </Button>
                {!isEnrolled ? (
                  <span className="text-xs text-muted">
                    Enroll above to start tracking this lesson.
                  </span>
                ) : null}
              </div>

              <article className="mt-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink-soft">
                  {selectedLesson.content}
                </p>
              </article>
            </>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No lessons yet"
              description="This learning path does not have any lessons to display yet."
            />
          )}
        </section>
      </div>
    </div>
  );
}
