import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { inputClasses } from './FormField';

const errorInputClasses = 'border-accent/70 focus:border-accent focus:ring-accent/15';

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
}

export function TextareaField({
  id,
  label,
  error,
  hint,
  className,
  rows = 4,
  ...props
}: TextareaFieldProps) {
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
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, 'resize-y', error && errorInputClasses, className)}
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
