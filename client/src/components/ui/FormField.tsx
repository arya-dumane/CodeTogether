import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const inputClasses =
  'mt-1.5 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted';

const errorInputClasses = 'border-accent/70 focus:border-accent focus:ring-accent/15';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, error && errorInputClasses, className)}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
