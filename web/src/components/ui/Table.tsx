import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageMeta } from '../../services/api/types';
import { Button } from './Button';

export function Table({
  caption,
  headers,
  children,
  compact = false,
  shimmerHeaders = false,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
  /** For a table inside a narrow panel: no minimum width, so it fits instead of scrolling sideways. */
  compact?: boolean;
  /** A loading table: the column headings are drawn as shimmering bars of their own length (the words stay for screen readers). */
  shimmerHeaders?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
      <table
        className={`w-full text-left text-sm [&_td_button:not([data-icon])]:min-h-8 [&_td_button:not([data-icon])]:px-3.5 [&_td_button:not([data-icon])]:text-xs ${compact ? '' : 'min-w-[40rem]'}`}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-brand-50 text-xs uppercase tracking-wide text-brand-800">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {shimmerHeaders ? (
                  // a bar the length of the word, inside the cell's own padding so the bars never touch
                  <span
                    className="shimmer inline-block select-none align-middle text-transparent"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-brand-700) 16%, white)',
                    }}
                  >
                    {h}
                  </span>
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * The one pagination bar of every table: "Showing a-b of n", Previous and Next, and "Page x of y". It shows whenever there
 * are results (the buttons are off on a single page). While `loading` (the next page is being fetched from the server) it
 * shows a spinner and the buttons are off, so a second click cannot race the first.
 */
export function Pagination({
  meta,
  onPage,
  loading = false,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
  loading?: boolean;
}) {
  if (meta.total <= 0) return null;
  const last = meta.last_page ?? Math.max(1, Math.ceil(meta.total / meta.per_page));
  const from = (meta.current_page - 1) * meta.per_page + 1;
  const to = Math.min(meta.current_page * meta.per_page, meta.total);
  return (
    <nav
      aria-label="Pagination"
      aria-busy={loading}
      className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2 text-muted" aria-live="polite">
        {loading && (
          <span
            role="status"
            aria-label="Loading"
            className="size-4 animate-spin rounded-full border-2 border-brand-700 border-t-transparent motion-reduce:animate-[spin_2s_linear_infinite]"
          />
        )}
        Showing {from}-{to} of {meta.total}
      </span>
      <span className="flex items-center justify-between gap-3 sm:justify-end">
        <Button
          variant="secondary"
          className="min-h-9 px-3"
          disabled={meta.current_page <= 1 || loading}
          title="Go to the previous page"
          onClick={() => onPage(meta.current_page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <span aria-current="page" className="whitespace-nowrap text-muted">
          Page {meta.current_page} of {Math.max(last, 1)}
        </span>
        <Button
          variant="secondary"
          className="min-h-9 px-3"
          disabled={meta.current_page >= last || loading}
          title="Go to the next page"
          onClick={() => onPage(meta.current_page + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </span>
    </nav>
  );
}
