import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

interface LogoProps {
  tone?: 'light' | 'dark';
  className?: string;
  to?: string;
}

export function Logo({ tone = 'light', className, to = '/' }: LogoProps) {
  const text = tone === 'light' ? 'text-ink' : 'text-paper';
  const mark = tone === 'light' ? 'bg-ink text-paper' : 'bg-paper text-ink';

  return (
    <Link
      to={to}
      className={cn('inline-flex items-center gap-2.5 rounded-md', className)}
      aria-label="CodeTogether"
    >
      <span
        aria-hidden="true"
        className={cn('grid h-8 w-8 place-items-center rounded-md font-mono text-xs font-semibold', mark)}
      >
        {'{ }'}
      </span>
      <span className={cn('text-[17px] font-semibold tracking-tight', text)}>CodeTogether</span>
    </Link>
  );
}
