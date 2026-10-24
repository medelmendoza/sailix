import type { ReactNode } from 'react';

/** One fact in a page hero's row: a small icon and the text. */
export function Fact({
  icon,
  children,
  mono,
}: {
  icon: ReactNode;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span aria-hidden="true" className="text-brand-700">
        {icon}
      </span>
      <span className={mono ? 'font-mono text-xs' : undefined}>{children}</span>
    </span>
  );
}

/** The pill link back to the list a detail page came from. */
export const BACK_PILL =
  'inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand-600 hover:text-brand-800';

/** A round avatar with the initials, in the brand colours. */
export function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?';
  return (
    <span
      aria-hidden="true"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 font-heading text-2xl font-bold text-white shadow-sm"
    >
      {initials}
    </span>
  );
}
