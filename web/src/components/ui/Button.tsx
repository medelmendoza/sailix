import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 disabled:bg-brand-800/50',
  secondary: 'border border-line bg-surface text-ink hover:bg-page disabled:text-muted',
  danger: 'bg-bad-fg text-white hover:opacity-90 disabled:opacity-50',
  ghost: 'text-accent-600 hover:bg-accent-100 disabled:text-muted',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        loading && 'cursor-progress',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <span aria-hidden="true" className="shimmer-overlay" />}
      {children}
    </button>
  );
}
