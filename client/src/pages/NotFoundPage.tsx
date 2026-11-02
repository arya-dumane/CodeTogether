import { Link } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { buttonClasses } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Container className="flex min-h-screen flex-col items-start justify-center py-16">
        <Logo />
        <p className="mt-12 font-mono text-sm text-muted">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          That page is not in the workspace.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          The link may be out of date, or the feature may not be part of the current phase.
        </p>
        <Link to="/" className={buttonClasses('primary', 'md', 'mt-6')}>
          Back to the landing page
        </Link>
      </Container>
    </div>
  );
}
