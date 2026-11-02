import { Link } from 'react-router-dom';
import {
  Check,
  ChartNoAxesColumnIncreasing,
  Compass,
  FolderKanban,
  LineChart,
  MessagesSquare,
  Route as RouteIcon,
  Target,
  Users,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { buttonClasses } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { CodeWindow } from '../components/marketing/CodeWindow';
import { useAuth } from '../hooks/useAuth';

const benefits = [
  {
    icon: Compass,
    title: 'Practise in context',
    body: 'Learning paths and challenges end in real files and real decisions, not isolated quizzes.',
  },
  {
    icon: MessagesSquare,
    title: 'Get unstuck together',
    body: 'Share a room, follow the same buffer, and work through a problem with a mentor or peer.',
  },
  {
    icon: LineChart,
    title: 'Watch progress accumulate',
    body: 'Paths, projects, rooms, and challenges live in one workspace instead of scattered tabs.',
  },
];

const features = [
  {
    icon: RouteIcon,
    title: 'Learning Paths',
    body: 'Guided tracks from language fundamentals to shipping a first project.',
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    body: 'A durable private home for the work you build, organized by account.',
  },
  {
    icon: Users,
    title: 'Coding Rooms',
    body: 'Private rooms with invite codes, member roles, and shared project or path context.',
  },
  {
    icon: Target,
    title: 'Challenges',
    body: 'Deliberate practice prompts that you can attempt in an isolated workspace.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: 'Progress',
    body: 'A clear view of what you have completed and what comes next.',
  },
  {
    icon: MessagesSquare,
    title: 'Community',
    body: 'Learn alongside other developers instead of working through material alone.',
  },
];

const availableNow = [
  'Account registration, sign-in, and sign-out',
  'Server-managed sessions with HTTP-only cookies',
  'CSRF protection on state-changing requests',
  'Protected workspace routes and session checks',
  'Persistent projects tied to each account',
  'Curated learning paths with lesson progress',
  'Private coding rooms with invite codes and member roles',
  'Responsive dashboard with live progress views',
  'Express API with a live health check',
];

const comingNext = [
  'Live room editing with Socket.IO, Yjs, presence, and cursors',
  'Challenges and an isolated practice workspace',
  'Room chat, community features, and mentorship',
];

export function LandingPage() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-grid lg:block" aria-hidden="true" />

        <Container className="relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-24">
          <div>
            <Badge tone="neutral">Phase 4A preview</Badge>

            <h1 className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Learn to code with someone in the file.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              CodeTogether brings structured paths, real projects, and private coding rooms into one
              workspace, so practice feels less like studying alone and more like building with a
              team.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className={buttonClasses('primary', 'lg')}
              >
                {isAuthenticated ? 'Open your workspace' : 'Create your account'}
              </Link>
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className={buttonClasses('secondary', 'lg')}
              >
                {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
              </Link>
            </div>

            <p className="mt-4 max-w-md text-xs leading-relaxed text-muted">
              Accounts, projects, learning paths, and private coding rooms are live. Live shared
              editing, challenges, and room chat are not implemented yet.
            </p>
          </div>

          <div className="relative">
            <CodeWindow />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Illustrative editor preview. Live collaborative editing is not part of Phase 4A.
            </p>
          </div>
        </Container>
      </section>

      <section id="why" className="border-b border-line py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <h2 className="max-w-sm text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Learning sticks when someone else is in the room.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              CodeTogether is built around the parts of learning that are hard to reproduce alone:
              shared context, quick feedback, and a reason to finish the thing you started.
            </p>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="grid gap-4 py-6 sm:grid-cols-[auto_1fr] sm:gap-5">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary-dark">
                  <benefit.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">{benefit.title}</h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{benefit.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="features" className="border-b border-line py-16 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              The workspace you&apos;ll grow into.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Each area is designed to stand on its own, then connect: a path leads to a project, a
              project opens a room, a room becomes practice. Phase 4A adds private rooms with invite
              codes, membership, and linked work to the secure account, project, and path foundation.
            </p>
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="border-t border-line pt-4">
                <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
            Accounts, projects, learning paths, and private coding rooms are implemented. Live
            shared editing, room chat, challenges, and code execution remain on the roadmap.
          </p>
        </Container>
      </section>

      <section id="roadmap" className="border-b border-line py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Badge tone="neutral">Phase 4A</Badge>
            <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Accounts, projects, learning paths, and private rooms are live.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              The workspace now protects your session, stores your projects, tracks progress through
              curated learning paths, and lets you invite people into a private room around shared
              work. Live editing and challenges are clearly labelled for the next phase.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">Available in this preview</h3>
              <ul className="mt-4 space-y-2.5">
                {availableNow.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-dashed border-line p-5">
              <h3 className="text-sm font-semibold text-ink">Coming next</h3>
              <ul className="mt-4 space-y-2.5">
                {comingNext.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="rounded-lg bg-sidebar px-6 py-10 sm:px-10 sm:py-12">
            <div className="max-w-2xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
                Create an account and open the workspace.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#AFC2B8]">
                Sign in to see the protected workspace, your projects, learning progress, and
                private rooms. Features that are not ready remain clearly marked.
              </p>
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className={buttonClasses(
                  'secondary',
                  'lg',
                  'mt-6 border-transparent bg-paper text-ink hover:border-transparent hover:bg-white',
                )}
              >
                {isAuthenticated ? 'Open the workspace' : 'Create your account'}
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
