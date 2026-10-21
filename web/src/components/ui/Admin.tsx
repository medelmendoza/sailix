import { useEffect, useState, type ReactNode } from 'react';
import { cn } from './cn';

const TONES = {
  blue: 'bg-accent-100 text-brand-800',
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-brand-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            'hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex',
            TONES[tone],
          )}
        >
          {icon}
        </span>
      )}
    </div>
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
  tabs: { key: string; label: string; count?: number }[];
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
            {t.count !== undefined && (
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
        className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-9 text-sm"
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
