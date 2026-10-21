import { ICONS } from '../../components/icons';
import { StatTile } from '../../components/ui';
import { useTenantCounts } from './api';

/** The summary row: how many organizations, how many are live, how many need attention, how many are closed. */
export function TenantSummary() {
  const c = useTenantCounts();
  const n = (v?: number) => (v === undefined ? '…' : v);
  const sum = (...v: (number | undefined)[]) =>
    v.some((x) => x === undefined) ? undefined : v.reduce<number>((a, b) => a + (b ?? 0), 0);
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Organizations"
        value={n(c.all)}
        hint="on the platform"
        icon={ICONS.organizations}
        tone="blue"
      />
      <StatTile
        label="Active"
        value={n(c.active)}
        hint="members can sign in"
        icon={ICONS.members}
        tone="green"
      />
      <StatTile
        label="Needs attention"
        value={n(sum(c.provisioning, c.suspended))}
        hint={`${n(c.provisioning)} setting up · ${n(c.suspended)} suspended`}
        icon={ICONS.callit}
        tone="amber"
      />
      <StatTile
        label="Closed"
        value={n(sum(c.deactivated, c.archived))}
        hint={`${n(c.deactivated)} deactivated · ${n(c.archived)} archived`}
        icon={ICONS.deletion}
        tone="slate"
      />
    </div>
  );
}
