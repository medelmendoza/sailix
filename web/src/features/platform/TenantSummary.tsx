import { ICONS } from '../../components/icons';
import { Skeleton, StatTile } from '../../components/ui';
import { useTenantCounts } from './api';

const sum = (...v: (number | undefined)[]) =>
  v.some((x) => x === undefined) ? undefined : v.reduce<number>((a, b) => a + (b ?? 0), 0);

/** The summary row: how many organizations, how many are live, how many need attention, how many are closed. */
export function TenantSummary() {
  const c = useTenantCounts();
  const figure = (v?: number) => (v === undefined ? <Skeleton className="h-[30px] w-10" /> : v);
  const hint = (ready: boolean, text: string) =>
    ready ? text : <Skeleton className="mt-1 h-3 w-32" />;
  const attention = c.provisioning !== undefined && c.suspended !== undefined;
  const closed = c.deactivated !== undefined && c.archived !== undefined;
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Organizations"
        value={figure(c.all)}
        hint="on the platform"
        icon={ICONS.organizations}
        tone="blue"
      />
      <StatTile
        label="Active"
        value={figure(c.active)}
        hint="members can sign in"
        icon={ICONS.members}
        tone="green"
      />
      <StatTile
        label="Needs attention"
        value={figure(sum(c.provisioning, c.suspended))}
        hint={hint(attention, `${c.provisioning} setting up · ${c.suspended} suspended`)}
        icon={ICONS.callit}
        tone="amber"
      />
      <StatTile
        label="Closed"
        value={figure(sum(c.deactivated, c.archived))}
        hint={hint(closed, `${c.deactivated} deactivated · ${c.archived} archived`)}
        icon={ICONS.deletion}
        tone="slate"
      />
    </div>
  );
}
