import { LayoutDashboard, Menu, Monitor, Smartphone, Tablet, Users } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, cn } from '../../components/ui';
import { ICONS } from '../../components/icons';

type Device = 'desktop' | 'tablet' | 'mobile';
type Tab = 'dashboard' | 'components';

const DEVICES: { key: Device; label: string; width: number; icon: typeof Monitor }[] = [
  { key: 'desktop', label: 'Desktop', width: 1000, icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { key: 'mobile', label: 'Mobile', width: 375, icon: Smartphone },
];

const NAV = [
  { label: 'Dashboard', icon: <LayoutDashboard className="size-4" />, active: true },
  { label: 'Crew', icon: <Users className="size-4" /> },
  { label: 'Documents', icon: ICONS.documents },
  { label: 'Announcements', icon: ICONS.announcements },
];

/** One small segmented control (the device and the page being previewed). */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; icon?: typeof Monitor }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-medium"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          title={o.label}
          onClick={() => onChange(o.key)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
            value === o.key ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink',
          )}
        >
          {o.icon ? <o.icon className="size-3.5" aria-hidden="true" /> : null}
          <span className={o.icon ? 'sr-only sm:not-sr-only' : undefined}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The admin portal as the organization's colours and font would show it: the side menu, a header, the figures and a few
 * ordinary controls. It is drawn at the width of the chosen device and scaled to fit the column, so it never scrolls.
 */
export function AdminPreview({
  vars,
  name,
  logoUrl,
  compact,
}: {
  /** The palette as CSS variables (colours and fonts), already worked out from the form. */
  vars: CSSProperties;
  name: string;
  logoUrl: string | null;
  /** The compact dashboard layout: smaller type and tighter spacing. */
  compact?: boolean;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const [tab, setTab] = useState<Tab>('dashboard');
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.4, height: 400 });
  const width = DEVICES.find((d) => d.key === device)!.width;
  const mobile = device === 'mobile';
  const tablet = device === 'tablet';

  useLayoutEffect(() => {
    const measure = () => {
      const outer = frame.current?.clientWidth ?? width;
      const scale = Math.min(1, outer / width);
      setBox({ scale, height: (inner.current?.offsetHeight ?? 0) * scale });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (frame.current) ro.observe(frame.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width, tab]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Page"
          value={tab}
          onChange={setTab}
          options={[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'components', label: 'Components' },
          ]}
        />
        <Segmented label="Device" value={device} onChange={setDevice} options={DEVICES} />
      </div>

      <div
        ref={frame}
        className="overflow-hidden rounded-xl border border-line"
        style={{ height: box.height || undefined }}
      >
        {/* aria-hidden: a picture of the portal, not a second copy of it for assistive technology */}
        <div
          ref={inner}
          aria-hidden="true"
          inert
          style={{
            ...vars,
            width,
            fontSize: compact ? 15 : 16,
            transform: `scale(${box.scale})`,
            transformOrigin: 'top left',
            backgroundColor: 'var(--color-page, #f4f8fc)',
            color: 'var(--color-ink, #0f2036)',
            fontFamily: (vars as Record<string, string>)['--font-sans'] ?? undefined,
          }}
          className="flex text-sm"
        >
          {!mobile && (
            <div
              className={cn('shrink-0 border-r border-line bg-surface', tablet ? 'w-48' : 'w-56')}
            >
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <img src="/sailix-logo.png" alt="" className="h-8 w-auto" />
                )}
                {logoUrl && (
                  <p className="min-w-0 truncate font-heading text-base font-bold">{name}</p>
                )}
              </div>
              <div className="px-3 py-4">
                <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  Manage
                </p>
                <div className="space-y-0.5">
                  {NAV.map((n) => (
                    <div
                      key={n.label}
                      className={cn(
                        'flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-1.5 font-medium',
                        n.active
                          ? 'bg-brand-50 text-brand-800 shadow-[inset_3px_0_0_var(--color-brand-700)]'
                          : 'text-ink',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full',
                          n.active
                            ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white'
                            : 'bg-brand-50 text-brand-800',
                        )}
                      >
                        {n.icon}
                      </span>
                      {n.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
              {mobile ? (
                <Menu className="size-5 text-muted" />
              ) : (
                <span className="text-muted">Administrator</span>
              )}
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                A
              </span>
            </div>

            <div className={cn('flex flex-col', compact ? 'gap-3 p-3.5' : 'gap-4 p-5')}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">
                  {name}
                </p>
                <h3 className="font-heading text-2xl font-bold">Welcome back, Alex</h3>
                <p className="text-muted">Overview of {name}.</p>
              </div>

              {tab === 'dashboard' ? (
                <>
                  <div className={cn('grid gap-3', mobile ? 'grid-cols-2' : 'grid-cols-4')}>
                    {[
                      ['Crew', '24'],
                      ['To review', '3'],
                      ['Announcements', '12'],
                      ['Requests', '0'],
                    ].map(([label, value], i) => (
                      <div
                        key={label}
                        className="rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--shadow-soft)]"
                      >
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
                          {label}
                        </p>
                        <p
                          className={cn(
                            'mt-1 font-heading text-2xl font-bold leading-none',
                            i === 1 ? 'text-accent-600' : 'text-brand-800',
                          )}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
                    <p className="font-heading text-base font-bold">Documents waiting</p>
                    <div className="mt-2 divide-y divide-line">
                      {['Passport — Maria Santos', 'Medical certificate — Jun Reyes'].map((t) => (
                        <div key={t} className="flex items-center justify-between gap-3 py-2">
                          <span className="truncate">{t}</span>
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                            Review
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-wrap gap-2">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Field</span>
                    <div className="min-h-10 rounded-xl border border-brand-600 bg-surface px-3.5 py-2.5 text-muted">
                      Focused field
                    </div>
                  </div>
                  <p>
                    Body text with a{' '}
                    <span className="font-medium text-accent-600 underline underline-offset-2">
                      link
                    </span>{' '}
                    and <span className="text-muted">quieter text</span>.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">
                      Brand
                    </span>
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-600">
                      Accent
                    </span>
                    <span className="rounded-full bg-ok-bg px-2.5 py-1 text-ok-fg">Approved</span>
                    <span className="rounded-full bg-warn-bg px-2.5 py-1 text-warn-fg">
                      Waiting
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">
        A sample of the admin portal. It changes as you edit, before anything is saved.
      </p>
    </div>
  );
}
