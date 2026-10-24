import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** A list with more than this many options gets a search box above it (shorter lists are only a list). */
export const SEARCH_THRESHOLD = 5;

/**
 * A dropdown you can type into: the box shows the choice, and the list that opens under it filters as you type, with the
 * arrow keys, Enter and Escape as in a native select. The list is drawn in a portal (inside the dialog when there is one) so
 * no card or table can clip it, and it flips above the box when there is no room below.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  searchLabel = 'Search',
  disabled,
  invalid,
  describedBy,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const listId = useId();
  const box = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [host, setHost] = useState<HTMLElement>(document.body);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);

  const searchable = options.filter((o) => !o.disabled).length > SEARCH_THRESHOLD;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  function close(refocus = false) {
    setOpen(false);
    setQuery('');
    if (refocus) box.current?.focus();
  }

  function choose(o: SelectOption) {
    if (o.disabled) return;
    onChange(o.value);
    close(true);
  }

  function toggle() {
    if (disabled) return;
    if (open) return close();
    setHost((box.current?.closest('[role="dialog"]') as HTMLElement | null) ?? document.body);
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setAt(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) close();
    };
    // positioned once: if the page scrolls, the list closes rather than drifting from its box
    const onScroll = (e: Event) => !pop.current?.contains(e.target as Node) && close();
    // Escape closes the list only: caught before it reaches the dialog around it, which would close as well
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onEsc, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !box.current || !pop.current) return;
    const t = box.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    // a host with a transform becomes the origin of `fixed` positions; otherwise they start at the window
    const o =
      host !== document.body && getComputedStyle(host).transform !== 'none'
        ? host.getBoundingClientRect()
        : { left: 0, top: 0 };
    const flip = t.bottom + 6 + p.height > window.innerHeight && t.top > p.height + 6;
    setAt({
      left: t.left - o.left,
      width: t.width,
      top: (flip ? t.top - p.height - 6 : t.bottom + 6) - o.top,
    });
  }, [open, host, shown.length]);

  useEffect(() => {
    if (open && at) (searchable ? search.current : pop.current)?.focus();
  }, [open, at, searchable]);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => Math.min(shown.length - 1, Math.max(0, a + step)));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : shown.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) choose(o);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        ref={box}
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-left text-sm transition-colors hover:border-brand-600/60 focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-page disabled:opacity-60',
          invalid ? 'border-bad-fg' : 'border-line',
          className,
        )}
      >
        <span className={cn('truncate', selected ? 'text-ink' : 'text-muted')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={pop}
            tabIndex={-1}
            onKeyDown={onKey}
            style={{
              position: 'fixed',
              top: at?.top ?? 0,
              left: at?.left ?? 0,
              width: at?.width,
              visibility: at ? 'visible' : 'hidden',
            }}
            className="z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)] focus:outline-none"
          >
            {searchable && (
              <div className="relative border-b border-line p-2">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  ref={search}
                  type="text"
                  role="combobox"
                  aria-label={searchLabel}
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Type to search…"
                  className="min-h-9 w-full rounded-lg border border-line bg-page pl-8 pr-3 text-sm focus:border-brand-600"
                />
              </div>
            )}
            <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto p-1">
              {shown.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">Nothing matches</li>
              ) : (
                shown.map((o, i) => (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={o.value === value}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
                      i === active && 'bg-brand-50 text-brand-800',
                      o.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && (
                      <Check className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>,
          host,
        )}
    </div>
  );
}
