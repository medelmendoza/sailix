import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--color-brand-700)_55%,transparent)] disabled:bg-brand-700/50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
  secondary:
    'border border-line bg-surface text-ink hover:border-brand-600 hover:text-brand-800 disabled:text-muted disabled:hover:border-line',
  danger:
    'bg-bad-fg text-white shadow-sm hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-50 disabled:hover:translate-y-0',
  ghost: 'text-brand-800 hover:bg-brand-50 disabled:text-muted',
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
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition duration-300 disabled:cursor-not-allowed',
        loading && 'cursor-progress',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        // a small ring turning at the left of the label, in the button's own text colour
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-[spin_2s_linear_infinite]"
        />
      )}
      {children}
    </button>
  );
}
