import { Card, Skeleton } from '../../components/ui';
import { TENANT_STATUSES, useTenantCounts } from './api';

const COLOURS: Record<(typeof TENANT_STATUSES)[number], string> = {
  active: 'bg-emerald-500',
  provisioning: 'bg-amber-400',
  suspended: 'bg-orange-500',
  deactivated: 'bg-slate-400',
  archived: 'bg-slate-300',
};

const LABELS: Record<(typeof TENANT_STATUSES)[number], string> = {
  active: 'Active',
  provisioning: 'Provisioning',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
  archived: 'Archived',
};

/** Organizations by lifecycle state: one stacked bar and a legend with the counts. */
export function StatusBreakdown() {
  const counts = useTenantCounts();
  const ready = counts.all !== undefined && TENANT_STATUSES.every((s) => counts[s] !== undefined);
  const total = counts.all ?? 0;
  return (
    <Card title="Organizations by status">
      {!ready ? (
        <div role="status" aria-label="Loading status breakdown">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-3/4" />
            ))}
          </div>
          <span className="sr-only">Loading…</span>
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted">No organizations yet.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={TENANT_STATUSES.map((s) => `${counts[s]} ${LABELS[s].toLowerCase()}`).join(
              ', ',
            )}
            className="flex h-3 w-full overflow-hidden rounded-full bg-line"
          >
            {TENANT_STATUSES.map((s) =>
              counts[s] ? (
                <div
                  key={s}
                  className={COLOURS[s]}
                  style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {TENANT_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${COLOURS[s]}`} />
                  {LABELS[s]}
                </span>
                <span className="font-medium">{counts[s]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
