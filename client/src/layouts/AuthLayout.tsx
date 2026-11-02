import { Link, Outlet } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Logo } from '../components/ui/Logo';

const guarantees = [
  'Passwords are hashed; plaintext is never stored',
  'Sessions live on the server behind HTTP-only cookies',
  'CSRF tokens protect state-changing requests',
];

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            to="/"
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid overflow-hidden rounded-lg border border-line bg-surface shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <div className="px-5 py-8 sm:px-10 sm:py-12">
            <Outlet />
          </div>

          <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
            <div className="absolute inset-0 bg-grid opacity-20" aria-hidden="true" />
            <div className="relative">
              <Badge tone="dark" className="bg-white/10 text-paper">
                Phase 4A
              </Badge>
              <h2 className="mt-6 max-w-sm text-balance text-3xl font-semibold leading-tight tracking-tight text-paper">
                A workspace that knows who you are.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#AFC2B8]">
                Sign in to open a protected workspace. Your identity stays on the server, and your
                session ends cleanly when you sign out.
              </p>
            </div>

            <ul className="relative mt-10 space-y-3 border-t border-white/10 pt-6">
              {guarantees.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-[#C8D6CF]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8FD0B8]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="relative mt-8 flex items-center gap-2 text-xs text-[#8FA69A]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              HTTP-only session cookies and CSRF protection
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
