import type { ReactNode } from 'react';
import { cn } from './cn';
import { Table } from './Table';

/** One loading block with the shimmer sweep. Hidden from screen readers: the container says "Loading". */
export function Skeleton({ className }: { className?: string }) {
  // rounded-md unless the caller chose its own corners (two radius classes on one element would fight)
  return (
    <div
      aria-hidden="true"
      className={cn('shimmer', !/\brounded/.test(className ?? '') && 'rounded-md', className)}
    />
  );
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
          className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]"
        >
          {/* the real StatTile's lines: label 16px, figure 30px (mt-1), hint 16px (mt-0.5) */}
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-1 flex h-[30px] items-center">
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-3 w-28" />
          </div>
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
      className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]"
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
      className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]"
    >
      <Skeleton className="mb-4 h-4 w-32" />
      <SkeletonLines lines={lines} />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/**
 * One kind of cell in a loading table: the shape of what the real cell holds, at the same height.
 * `stack` is a name over a small grey line (two lines), `stack3` has a third; `actions1` to `actions3` are that many round
 * icon buttons at the end of the row.
 */
export type CellKind =
  | 'identity'
  | 'text'
  | 'strong'
  | 'stack'
  | 'stack3'
  | 'mono'
  | 'pill'
  | 'date'
  | 'chevron'
  | 'actions1'
  | 'actions2'
  | 'actions3'
  | 'actions4';

const WIDTHS = ['w-40', 'w-32', 'w-44', 'w-36'];
const TEXT = ['w-24', 'w-28', 'w-20', 'w-32'];

function SkeletonCell({ kind, row }: { kind: CellKind; row: number }) {
  const w = WIDTHS[row % WIDTHS.length] ?? 'w-36';
  const line = (cls: string, h = 'h-5') => (
    <div className={cn('flex items-center', h)}>
      <Skeleton className={cn('h-3.5', cls)} />
    </div>
  );
  switch (kind) {
    case 'identity':
      return (
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className={cn('h-3.5', w)} />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      );
    case 'mono':
      return (
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-28" />
        </div>
      );
    case 'pill':
      return <Skeleton className="h-5 w-20 rounded-full" />;
    case 'date':
      return line('w-32');
    case 'chevron':
      return <Skeleton className="ml-auto h-4 w-3" />;
    case 'strong':
      return line(w);
    case 'stack':
      return (
        <div>
          {line(w)}
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
        </div>
      );
    case 'stack3':
      return (
        <div>
          {line(w)}
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      );
    case 'actions1':
    case 'actions2':
    case 'actions3':
    case 'actions4': {
      // the real row actions are round 36px icon buttons
      const n = Number(kind.slice(-1));
      return (
        <div className="flex justify-end gap-1">
          {Array.from({ length: n }, (_, i) => (
            <Skeleton key={i} className="size-9 shrink-0 rounded-full" />
          ))}
        </div>
      );
    }
    default:
      return line(TEXT[row % TEXT.length] ?? 'w-24');
  }
}

/**
 * A loading table that IS the real table: same frame, same column headers (they are known text), same row padding, with
 * each cell replaced by a shimmering shape of the kind it will hold, so nothing moves when the rows arrive.
 */
export function SkeletonDataTable({
  caption,
  headers,
  cells,
  rows = 6,
  label = 'Loading',
  compact = false,
}: {
  caption: string;
  headers: string[];
  cells: CellKind[];
  rows?: number;
  label?: string;
  /** The same as `compact` on the real table: no minimum width, for a table inside a narrow panel. */
  compact?: boolean;
}) {
  return (
    <div role="status" aria-label={label}>
      <Table caption={caption} headers={headers} compact={compact} shimmerHeaders>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {cells.map((kind, c) => (
              <td
                key={c}
                className={cn(
                  'px-4 py-3',
                  kind === 'chevron' && 'w-10 px-2',
                  kind.startsWith('actions') && 'whitespace-nowrap text-right',
                )}
              >
                <SkeletonCell kind={kind} row={r} />
              </td>
            ))}
          </tr>
        ))}
      </Table>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** A form field whose label (and hint) are known text: only the control shimmers. */
export function SkeletonField({ label, hint }: { label: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Skeleton className="min-h-10 w-full rounded-xl" />
      {hint && <p className="text-xs text-muted">{hint}</p>}
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
                  <Skeleton className="size-8 rounded-full" />
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
        <div className="w-full space-y-5 p-[var(--page-pad)]">
          <Skeleton className="h-8 w-56" />
          <SkeletonStatTiles />
          <SkeletonTable rows={4} />
        </div>
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
