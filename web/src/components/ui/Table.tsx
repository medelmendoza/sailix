import type { ReactNode } from 'react';
import type { PageMeta } from '../../services/api/types';
import { Button } from './Button';

export function Table({
  caption,
  headers,
  children,
  compact = false,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
  /** For a table inside a narrow panel: no minimum width, so it fits instead of scrolling sideways. */
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={`w-full text-left text-sm ${compact ? '' : 'min-w-[40rem]'}`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  const last = meta.last_page ?? Math.max(1, Math.ceil(meta.total / meta.per_page));
  if (last <= 1) return <p className="mt-3 text-xs text-muted">{meta.total} total</p>;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {meta.current_page} of {last} · {meta.total} total
      </span>
      <span className="flex gap-2">
        <Button
          variant="secondary"
          disabled={meta.current_page <= 1}
          onClick={() => onPage(meta.current_page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={meta.current_page >= last}
          onClick={() => onPage(meta.current_page + 1)}
        >
          Next
        </Button>
      </span>
    </nav>
  );
}
