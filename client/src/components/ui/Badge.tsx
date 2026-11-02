import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'accent' | 'dark' | 'outline';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-primary-soft text-primary-dark',
  success: 'bg-primary-soft text-primary-dark',
  warning: 'bg-[#FBF1DA] text-[#7A5514]',
  accent: 'bg-accent-soft text-[#8A3A21]',
  dark: 'bg-ink text-paper',
  outline: 'border border-line bg-transparent text-muted',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
