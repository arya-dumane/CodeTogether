import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/cn';

type NoticeTone = 'success' | 'error' | 'info';

const tones: Record<NoticeTone, { wrapper: string; icon: string }> = {
  success: { wrapper: 'border-primary/25 bg-primary-soft/60 text-ink-soft', icon: 'text-primary' },
  error: { wrapper: 'border-[#E7C9BD] bg-accent-soft/50 text-ink-soft', icon: 'text-accent' },
  info: { wrapper: 'border-line bg-surface text-ink-soft', icon: 'text-primary' },
};

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}

export function Notice({ tone = 'info', children, className }: NoticeProps) {
  const Icon = icons[tone];
  const styles = tones[tone];

  return (
    <div
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm', styles.wrapper, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
