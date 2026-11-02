import { useLocation } from 'react-router-dom';
import { Info, Layers, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { HealthCard } from '../components/dashboard/HealthCard';
import { LearningProgressCard } from '../components/dashboard/LearningProgressCard';
import { Badge } from '../components/ui/Badge';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { formatDate, initials } from '../lib/format';

const foundationCoverage = [
  'Account registration and sign-in',
  'Server-managed sessions with HTTP-only cookies',
  'Protected dashboard routes and session checks',
  'Owner-scoped project creation, editing, and deletion',
  'Curated learning paths with ordered modules and lessons',
  'Enrollment and per-lesson progress that persists across sessions',
  'Private coding rooms with invite codes and member controls',
  'CSRF protection on state-changing requests',
  'Shared design tokens and reusable components',
];

interface OverviewLocationState {
  flash?: string;
}

export function DashboardOverview() {
  const { user } = useAuth();
  const location = useLocation();
  const flash = (location.state as OverviewLocationState | null)?.flash;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${user?.displayName ?? 'there'}. Your account, projects, learning progress, and coding rooms are live; challenges and shared editing are still planned.`}
        actions={<Badge tone="success">Phase 4A</Badge>}
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="flex gap-3 rounded-lg border border-line bg-primary-soft/40 px-4 py-3" role="note">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">
            Accounts, projects, learning paths, and coding rooms are live.
          </span>{' '}
          Challenges, shared editing, and room chat are still placeholders.
        </p>
      </div>

      <LearningProgressCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthCard />

        <section
          className="rounded-lg border border-line bg-surface p-6"
          aria-labelledby="account-heading"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="account-heading" className="text-base font-semibold text-ink">
                Your account
              </h2>
              <p className="mt-1 text-sm text-muted">The identity behind this session.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark">
              {user ? initials(user.displayName) : '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user?.displayName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Member since</dt>
              <dd className="text-ink-soft">{user ? formatDate(user.createdAt) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Session</dt>
              <dd className="flex items-center gap-1.5 text-ink-soft">
                <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                HTTP-only cookie
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Protection</dt>
              <dd className="flex items-center gap-1.5 text-ink-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                CSRF checked
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section
        className="rounded-lg border border-line bg-surface p-6"
        aria-labelledby="foundation-heading"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-dark">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="foundation-heading" className="text-base font-semibold text-ink">
              What this workspace provides
            </h2>
            <p className="mt-1 text-sm text-muted">
              Account security, persistent projects, structured learning progress, and private
              rooms are ready for the live collaboration phases to build on.
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {foundationCoverage.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
