import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white bg-surface p-5 shadow-sm ring-1 ring-line',
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {actions}
        </div>
      )}
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
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-accent-600 border-t-transparent"
      />
      {label}…
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
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
