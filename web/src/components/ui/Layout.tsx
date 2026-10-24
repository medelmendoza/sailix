import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';
import { SkeletonLines } from './Skeleton';

export function Card({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: string;
  /** A line of explanation under the title. */
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-pad)] shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {description && <p className="-mt-2 mb-4 text-sm text-muted">{description}</p>}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="title-bar text-3xl font-bold leading-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** The generic loading placeholder (a few shimmering lines). Pages with a known shape use the matching Skeleton instead. */
/**
 * The welcome banner at the top of a console's dashboard: the brand colours as a gradient, soft blobs and a dot grid,
 * white text. Decorative parts are hidden from screen readers.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  footer,
  mark: Mark,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** A row under the text (summary chips, say). */
  footer?: ReactNode;
  /** A large, faint drawing behind the right side of the banner. */
  mark?: LucideIcon;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-[var(--shadow-lift)] sm:p-8">
      <div aria-hidden="true" className="bg-dots absolute inset-0" />
      <div
        aria-hidden="true"
        className="float-slow absolute -bottom-28 -right-16 size-72 rounded-full bg-accent-500/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-24 size-60 rounded-full bg-brand-600/45 blur-3xl"
      />
      {Mark && (
        <Mark
          aria-hidden="true"
          strokeWidth={1.1}
          className="pointer-events-none absolute -bottom-10 right-6 hidden size-64 -rotate-12 text-white/[0.08] md:block"
        />
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90 ring-1 ring-white/20">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-500" />
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-xl text-sm text-white/80">{description}</p>}
          {footer && <div className="mt-5 flex flex-wrap items-center gap-2">{footer}</div>}
        </div>
        {actions}
      </div>
    </section>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="py-4">
      <SkeletonLines lines={4} />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-bad-fg/30 bg-bad-bg px-4 py-4 text-sm text-bad-fg"
    >
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad-fg">
      {message}
    </p>
  );
}
