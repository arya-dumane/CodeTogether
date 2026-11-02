import { Link, Outlet } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { Logo } from '../components/ui/Logo';
import { buttonClasses } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const navigation = [
  { href: '#why', label: 'Why CodeTogether' },
  { href: '#features', label: 'Features' },
  { href: '#roadmap', label: 'Roadmap' },
];

export function PublicLayout() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className={buttonClasses('primary', 'sm')}>
                Open workspace
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClasses('ghost', 'sm', 'hidden sm:inline-flex')}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses('primary', 'sm')}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </Container>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              A collaborative workspace for learning to code, building projects, and practising with
              other developers.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted sm:items-end">
            <a href="#features" className="transition-colors hover:text-ink">
              Features
            </a>
            <a href="#roadmap" className="transition-colors hover:text-ink">
              Roadmap
            </a>
            <p className="pt-1 text-xs text-muted/80">Phase 4A preview</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
