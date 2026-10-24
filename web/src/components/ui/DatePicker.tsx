import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const todayIso = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
};

/** "May 4, 1990" from "1990-05-04". */
export const showDate = (value: string) =>
  new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  ).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * A date picker in place of the browser's own calendar: a box showing the date, and a rounded calendar that opens under it
 * (in a portal, so no card or dialog can clip it). Month and year are quick selects, so a birthday decades back is two
 * clicks. The value is always `YYYY-MM-DD`, or empty.
 */
export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  className,
  disabled,
  min,
  max,
  placeholder = 'Select date…',
  invalid,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  /** Earliest and latest pickable day (`YYYY-MM-DD`); days outside are greyed out. */
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const today = todayIso();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  // inside a dialog the calendar must live in the dialog (it blocks everything outside it); anywhere else it goes to the page body
  const [host, setHost] = useState<HTMLElement>(document.body);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const start = value || today;
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const [month, setMonth] = useState(Number(start.slice(5, 7)) - 1);

  function close() {
    setOpen(false);
    onBlur?.();
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) close();
    };
    // caught before it reaches the dialog around the picker, which would close as well
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    // the calendar is positioned once, so it closes if anything scrolls rather than drifting from its box
    const onScroll = (e: Event) => !pop.current?.contains(e.target as Node) && close();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // under the box, or above it / flush right when it would run off the screen
  useLayoutEffect(() => {
    if (!open || !box.current || !pop.current) return;
    const t = box.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    // a host with a transform becomes the origin of `fixed` positions; otherwise they start at the window
    const o =
      host !== document.body && getComputedStyle(host).transform !== 'none'
        ? host.getBoundingClientRect()
        : { left: 0, top: 0 };
    setCoords({
      left:
        (t.left + p.width > window.innerWidth ? Math.max(8, t.right - p.width) : t.left) - o.left,
      top:
        (t.bottom + 6 + p.height > window.innerHeight ? t.top - p.height - 6 : t.bottom + 6) -
        o.top,
    });
  }, [open, month, year, host]);

  function toggle() {
    if (disabled) return;
    const ref = value || today;
    setYear(Number(ref.slice(0, 4)));
    setMonth(Number(ref.slice(5, 7)) - 1);
    setCoords(null);
    setHost((box.current?.closest('[role="dialog"]') as HTMLElement | null) ?? document.body);
    setOpen((o) => !o);
  }

  function step(delta: number) {
    const m = month + delta;
    setMonth((m + 12) % 12);
    if (m < 0) setYear(year - 1);
    if (m > 11) setYear(year + 1);
  }

  const blocked = (d: string) => (min != null && d < min) || (max != null && d > max);
  const pick = (d: string) => {
    onChange(d);
    close();
  };

  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d < 1 || d > days ? null : d;
  });
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 111 }, (_, i) => thisYear + 10 - i);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-left text-sm transition-colors hover:border-brand-600/60 focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-page disabled:opacity-60',
          invalid ? 'border-bad-fg' : 'border-line',
          className,
        )}
      >
        <span className={value ? 'text-ink' : 'text-muted'}>
          {value ? showDate(value) : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              className="rounded-full p-0.5 text-muted hover:bg-brand-50 hover:text-brand-800"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </span>
          )}
          <CalendarDays className="size-4 text-brand-700" aria-hidden="true" />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Choose a date"
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-50 w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center gap-1 bg-gradient-to-r from-brand-50 to-accent-50 px-2 py-2">
              <button
                type="button"
                title="Previous month"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-brand-700 shadow-sm hover:bg-surface"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <select
                aria-label="Month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {MONTHS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md bg-transparent px-1 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Next month"
                aria-label="Next month"
                onClick={() => step(1)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-brand-700 shadow-sm hover:bg-surface"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-2.5">
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    className={i === 0 || i === 6 ? 'text-accent-600' : ''}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (d == null) return <div key={i} />;
                  const day = iso(year, month, d);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={showDate(day)}
                      aria-pressed={day === value}
                      disabled={blocked(day)}
                      onClick={() => pick(day)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-lg text-xs transition-colors disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent',
                        day === value
                          ? 'bg-brand-700 font-semibold text-white'
                          : day === today
                            ? 'bg-accent-50 font-semibold text-accent-600'
                            : 'text-ink hover:bg-brand-50',
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line px-3 py-2">
              <button
                type="button"
                disabled={blocked(today)}
                onClick={() => pick(today)}
                className="text-xs font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="text-xs font-medium text-muted hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          host,
        )}
    </div>
  );
}
