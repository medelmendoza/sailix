import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

const TONES = {
  blue: 'bg-brand-100 text-brand-800',
  green: 'bg-ok-bg text-ok-fg',
  amber: 'bg-warn-bg text-warn-fg',
  red: 'bg-bad-bg text-bad-fg',
  slate: 'bg-line/60 text-muted',
} as const;

/** A headline figure with a label and a short hint, on a round tinted icon: the summary row of a console page. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'blue',
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  /** Makes the whole tile a link to where the figure comes from. */
  to?: string;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted sm:text-xs">
          {label}
        </p>
        <p className="mt-1 font-heading text-3xl font-bold leading-none text-brand-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            'hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex',
            TONES[tone],
          )}
        >
          {icon}
        </span>
      )}
    </>
  );
  const frame =
    'card-hover flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]';
  return to ? (
    <Link to={to} className={frame}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

/** Tabs that filter a list (All, Active, ...), each with its count. The chosen one is `value`; '' is "All". */
export function StatusTabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  /** `count: null` means the figure is still loading. */
  tabs: { key: string; label: string; count?: number | null }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              selected
                ? 'border-accent-600 text-brand-800'
                : 'border-transparent text-muted hover:text-brand-800',
            )}
          >
            {t.label}
            {t.count === null && <Skeleton className="h-5 w-7 rounded-full" />}
            {t.count !== undefined && t.count !== null && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  selected ? 'bg-accent-100 text-brand-800' : 'bg-line/60 text-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A search box that reports what was typed after a short pause, with a clear button. `value` is the applied search. */
export function SearchField({
  label,
  placeholder,
  value,
  onSearch,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onSearch: (value: string) => void;
}) {
  const [typed, setTyped] = useState(value);
  // follow the applied value when it changes from outside (Clear filters, back button)
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setTyped(value);
  }

  useEffect(() => {
    if (typed === value) return;
    const t = setTimeout(() => onSearch(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed, value, onSearch]);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-9 text-sm transition-colors hover:border-brand-600/60 focus:border-brand-600"
      />
      {typed && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setTyped('');
            onSearch('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-muted hover:text-brand-800"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * The section tabs of a detail page: plain text with a line under the open one, and a faint line under the one you point
 * at. `id` ties each tab to its panel (`panel-<key>`), which the page labels with `tab-<key>`.
 */
export function ProfileTabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={selected}
            aria-controls={`panel-${t.key}`}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative -mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              selected
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-muted hover:border-line hover:text-ink',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The bar that stays at the bottom of an editing page: says whether there is anything unsaved, and holds Discard and Save
 * changes (and anything extra, such as a reset). Pass `formId` to make Save submit that form, or `onSave` otherwise.
 */
export function SaveBar({
  dirty,
  saving = false,
  canSave = true,
  onDiscard,
  onSave,
  formId,
  extra,
}: {
  dirty: boolean;
  saving?: boolean;
  /** False while something is invalid: Save stays off. */
  canSave?: boolean;
  onDiscard: () => void;
  onSave?: () => void;
  formId?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
      <span
        role="status"
        className={cn('text-sm', dirty ? 'font-medium text-warn-fg' : 'text-muted')}
      >
        {dirty ? 'You have unsaved changes' : 'All changes saved'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {dirty && (
          <Button variant="secondary" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button
          type={formId ? 'submit' : 'button'}
          form={formId}
          onClick={formId ? undefined : onSave}
          loading={saving}
          disabled={!dirty || !canSave}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
