import { cn } from './cn';

/** One loading block with the shimmer sweep. Hidden from screen readers: the container says "Loading". */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('shimmer rounded-md', className)} />;
}

/** A few lines of text, each a different length, so it reads as text and not as a bar. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-5/6', 'w-2/3', 'w-3/4', 'w-1/2'];
  return (
    <div aria-hidden="true" className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** The summary row of a console page while its figures load. */
export function SkeletonStatTiles({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white bg-surface p-4 shadow-sm ring-1 ring-line"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** A table while its rows load: the same frame as the real one, with a header and placeholder rows. */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  label = 'Loading',
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="overflow-hidden rounded-2xl border border-white bg-surface shadow-sm ring-1 ring-line"
    >
      <div
        className="grid gap-4 border-b border-line bg-page px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="grid items-center gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, c) =>
              c === 0 ? (
                <div key={c} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ) : (
                <Skeleton key={c} className={cn('h-3.5', c % 2 ? 'w-2/3' : 'w-1/2')} />
              ),
            )}
          </div>
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** A card with a title and some lines. */
export function SkeletonCard({ lines = 4, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="rounded-2xl border border-white bg-surface p-5 shadow-sm ring-1 ring-line"
    >
      <Skeleton className="mb-4 h-4 w-32" />
      <SkeletonLines lines={lines} />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** A form while its values load. */
export function SkeletonForm({
  fields = 3,
  label = 'Loading',
}: {
  fields?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="rounded-2xl border border-white bg-surface p-5 shadow-sm ring-1 ring-line"
    >
      <div className="flex max-w-lg flex-col gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** The header card of a detail page (avatar, name, tabs) while it loads. */
export function SkeletonDetail({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="mb-4 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="hidden h-10 w-24 sm:block" />
        </div>
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
      <SkeletonCard lines={5} />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** The whole console frame (sidebar, top bar, content) while the session is being checked. */
export function SkeletonShell({ label = 'Checking your session' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="flex items-center gap-2.5 border-b border-line px-6 py-4">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-6 px-3 py-4">
          {[3, 2, 1].map((n, s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="ml-3 h-3 w-16" />
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5">
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-6">
          <Skeleton className="h-8 w-56" />
          <SkeletonStatTiles />
          <SkeletonTable rows={4} />
        </div>
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
