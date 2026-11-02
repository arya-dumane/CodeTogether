import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { LearningPathCard } from '../components/learning-paths/LearningPathCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { inputClasses } from '../components/ui/FormField';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useLearningPaths, useMyLearningProgress } from '../hooks/useLearningPaths';
import type { LearningDifficulty } from '../lib/api/learningPaths';
import { cn } from '../lib/cn';

type DifficultyFilter = LearningDifficulty | 'all';

export function LearningPathsPage() {
  const { paths, error, isLoading, refetch } = useLearningPaths();
  const { enrollments, error: progressError } = useMyLearningProgress();

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [category, setCategory] = useState('all');

  const progressByPath = useMemo(
    () => new Map(enrollments.map((entry) => [entry.path.id, entry.progress])),
    [enrollments],
  );

  const categories = useMemo(
    () => [...new Set(paths.map((path) => path.category))].sort((a, b) => a.localeCompare(b)),
    [paths],
  );

  const filteredPaths = useMemo(() => {
    const query = search.trim().toLowerCase();

    return paths.filter((path) => {
      const matchesQuery =
        query.length === 0 ||
        path.title.toLowerCase().includes(query) ||
        path.shortDescription.toLowerCase().includes(query) ||
        path.category.toLowerCase().includes(query);
      const matchesDifficulty = difficulty === 'all' || path.difficulty === difficulty;
      const matchesCategory = category === 'all' || path.category === category;

      return matchesQuery && matchesDifficulty && matchesCategory;
    });
  }, [paths, search, difficulty, category]);

  const hasFilters = search.trim().length > 0 || difficulty !== 'all' || category !== 'all';
  const resetFilters = () => {
    setSearch('');
    setDifficulty('all');
    setCategory('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Paths"
        description="Structured tracks that take you from fundamentals to shipping real work. Enroll, complete lessons, and watch your progress persist."
        actions={<Badge tone="success">Phase 3</Badge>}
      />

      {!isLoading && !error ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone="outline">{paths.length} published paths</Badge>
          <Badge tone="outline">{enrollments.length} enrolled</Badge>
        </div>
      ) : null}

      {progressError ? (
        <Notice tone="info">
          Your saved progress could not be loaded right now. You can still browse every path.
        </Notice>
      ) : null}

      {isLoading ? (
        <Spinner label="Loading learning paths..." />
      ) : error ? (
        <ErrorState title="Learning paths unavailable" message={error} onRetry={refetch} />
      ) : paths.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No learning paths yet"
          description="Published learning paths will appear here once an administrator adds them."
        />
      ) : (
        <>
          <section
            className="rounded-lg border border-line bg-surface p-4"
            aria-label="Filter learning paths"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <div>
                <label htmlFor="path-search" className="text-sm font-medium text-ink">
                  Search
                </label>
                <div className="relative mt-1.5">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="path-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title, topic, or category"
                    className={cn(inputClasses, 'mt-0 pl-9')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="path-difficulty" className="text-sm font-medium text-ink">
                  Difficulty
                </label>
                <select
                  id="path-difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)}
                  className={inputClasses}
                >
                  <option value="all">All levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label htmlFor="path-category" className="text-sm font-medium text-ink">
                  Category
                </label>
                <select
                  id="path-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClasses}
                >
                  <option value="all">All categories</option>
                  {categories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                Showing {filteredPaths.length} of {paths.length} paths
              </span>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </section>

          {filteredPaths.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No paths match your filters"
              description="Try a different search term, difficulty, or category."
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPaths.map((path) => (
                <LearningPathCard
                  key={path.id}
                  path={path}
                  progress={progressByPath.get(path.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
