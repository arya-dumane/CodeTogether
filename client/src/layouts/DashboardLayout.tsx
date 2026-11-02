import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Route as RouteIcon,
  Target,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  soon?: boolean;
}

const mainNavigation: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/learning-paths', label: 'Learning Paths', icon: RouteIcon },
  { to: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { to: '/dashboard/rooms', label: 'Coding Rooms', icon: Users },
  { to: '/dashboard/challenges', label: 'Challenges', icon: Target, soon: true },
];

const accountNavigation: NavItem[] = [
  { to: '/dashboard/settings', label: 'Profile & settings', icon: UserCog, soon: true },
];

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-white/10 font-medium text-paper'
      : 'text-[#AFC2B8] hover:bg-white/5 hover:text-paper',
  );
}

function SidebarContent({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo tone="dark" to="/dashboard" />
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-[#AFC2B8] transition-colors hover:bg-white/10 hover:text-paper"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-medium text-[#8FA69A]">Workspace</p>
        <ul className="space-y-1">
          {mainNavigation.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClasses} onClick={onNavigate}>
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.soon ? (
                  <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] leading-none text-[#8FA69A]">
                    Soon
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <ul className="space-y-1">
          {accountNavigation.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={navLinkClasses} onClick={onNavigate}>
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.soon ? (
                  <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] leading-none text-[#8FA69A]">
                    Soon
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>

        <Link
          to="/"
          className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-[#8FA69A] transition-colors hover:bg-white/5 hover:text-paper"
          onClick={onNavigate}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to the landing page
        </Link>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen border-r border-white/5 bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {isNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
          />
          <aside
            id="workspace-navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-2xl"
          >
            <SidebarContent onNavigate={() => setIsNavOpen(false)} onClose={() => setIsNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-md border border-line bg-surface text-ink-soft transition-colors hover:border-primary/40 hover:text-ink lg:hidden"
              onClick={() => setIsNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={isNavOpen}
              aria-controls="workspace-navigation"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {user ? `Welcome, ${user.displayName}` : 'CodeTogether workspace'}
              </p>
              <p className="hidden text-xs text-muted sm:block">
                Accounts, projects, learning paths, and rooms are live. Challenges and collaborative
                editing remain placeholders.
              </p>
            </div>

            <Badge tone="success" className="hidden md:inline-flex">
              Phase 4A
            </Badge>

            {user ? (
              <div
                className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5"
                title={user.email}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-dark">
                  {initials(user.displayName)}
                </span>
                <span className="hidden max-w-32 truncate text-xs font-medium text-ink-soft sm:inline">
                  {user.displayName}
                </span>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              aria-label="Sign out"
              title="Sign out"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main id="main" className="px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
