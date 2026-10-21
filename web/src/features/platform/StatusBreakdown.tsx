import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, cn, Skeleton } from '../../components/ui';
import { TENANT_STATUSES, useTenantCounts } from './api';

type Status = (typeof TENANT_STATUSES)[number];

/** Status colours are fixed meanings (live, setting up, blocked, closed); each row also names its status, never colour alone. */
const SEGMENTS: Record<Status, { label: string; note: string; stroke: string; fill: string }> = {
  active: {
    label: 'Active',
    note: 'members can sign in',
    stroke: 'stroke-emerald-500',
    fill: 'bg-emerald-500',
  },
  provisioning: {
    label: 'Provisioning',
    note: 'being set up',
    stroke: 'stroke-amber-400',
    fill: 'bg-amber-400',
  },
  suspended: {
    label: 'Suspended',
    note: 'sign-in blocked',
    stroke: 'stroke-orange-500',
    fill: 'bg-orange-500',
  },
  deactivated: {
    label: 'Deactivated',
    note: 'closed, can be reopened',
    stroke: 'stroke-slate-400',
    fill: 'bg-slate-400',
  },
  archived: {
    label: 'Archived',
    note: 'kept for the record',
    stroke: 'stroke-slate-300',
    fill: 'bg-slate-300',
  },
};

/** The order they are shown in: live first, then the ones that need a look, then the closed ones. */
const ORDER: Status[] = ['active', 'provisioning', 'suspended', 'deactivated', 'archived'];

const R = 44;
const C = 2 * Math.PI * R;
const GAP = 3; // the surface shows between neighbouring segments

/**
 * Organizations by lifecycle state: a ring with the total in the middle, and a row per status (count, share, a thin bar)
 * that opens the Organizations list filtered to it. Pointing at a segment or a row highlights the other.
 */
export function StatusBreakdown() {
  const counts = useTenantCounts();
  const [hover, setHover] = useState<Status | null>(null);
  const ready = counts.all !== undefined && TENANT_STATUSES.every((s) => counts[s] !== undefined);
  if (!ready) return <BreakdownSkeleton />;

  const total = counts.all ?? 0;
  const share = (s: Status) => (total === 0 ? 0 : (counts[s] ?? 0) / total);
  const present = ORDER.filter((s) => (counts[s] ?? 0) > 0);
  // where each arc starts along the ring
  const arcs: { s: Status; len: number; start: number }[] = [];
  let offset = 0;
  for (const s of present) {
    const len = share(s) * C;
    arcs.push({ s, len, start: offset });
    offset += len;
  }

  return (
    <Card title="Organizations by status">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative size-44 shrink-0">
          <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={ORDER.map((s) => `${counts[s]} ${SEGMENTS[s].label.toLowerCase()}`).join(
              ', ',
            )}
            className="size-full -rotate-90"
          >
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="14" className="stroke-line" />
            {arcs.map(({ s, len, start }) => {
              const dash = present.length > 1 ? Math.max(len - GAP, 0.5) : len;
              return (
                <circle
                  key={s}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  strokeWidth={hover === s ? 17 : 14}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-start}
                  className={cn(
                    SEGMENTS[s].stroke,
                    'transition-all duration-300',
                    hover && hover !== s && 'opacity-30',
                  )}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${SEGMENTS[s].label}: ${counts[s]} (${Math.round(share(s) * 100)}%)`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-heading text-4xl font-bold leading-none text-brand-800">
              {hover ? counts[hover] : total}
            </span>
            <span className="mt-1 text-xs font-medium text-muted">
              {hover
                ? SEGMENTS[hover].label.toLowerCase()
                : total === 1
                  ? 'organization'
                  : 'organizations'}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 divide-y divide-line text-sm">
          {ORDER.map((s) => (
            <li key={s}>
              <Link
                to={`/platform/tenants?status=${s}`}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s)}
                onBlur={() => setHover(null)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-brand-50',
                  hover && hover !== s && 'opacity-60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-3 shrink-0 rounded-full', SEGMENTS[s].fill)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{SEGMENTS[s].label}</span>
                    <span className="shrink-0">
                      <span className="font-semibold">{counts[s]}</span>
                      <span className="ml-1.5 text-xs text-muted">
                        {Math.round(share(s) * 100)}%
                      </span>
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
                    <span
                      className={cn(
                        'block h-full rounded-full transition-all duration-500',
                        SEGMENTS[s].fill,
                      )}
                      style={{ width: `${share(s) * 100}%` }}
                    />
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-muted transition-transform group-hover:translate-x-0.5"
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** The card while the counts load: the real title, a ring where the ring will be, and a row per status. */
function BreakdownSkeleton() {
  return (
    <Card title="Organizations by status">
      <div
        role="status"
        aria-label="Loading status breakdown"
        className="flex flex-col items-center gap-6 sm:flex-row sm:items-center"
      >
        <div className="relative size-44 shrink-0">
          <Skeleton className="size-full rounded-full" />
          <div className="absolute inset-[14%] rounded-full bg-surface" />
        </div>
        <ul className="w-full min-w-0 flex-1 divide-y divide-line">
          {ORDER.map((s) => (
            <li key={s} className="flex items-center gap-3 px-2 py-2.5">
              <Skeleton className="size-3 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{SEGMENTS[s].label}</span>
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
              </div>
              <span aria-hidden="true" className="w-1.5" />
            </li>
          ))}
        </ul>
        <span className="sr-only">Loading…</span>
      </div>
    </Card>
  );
}
