import { Link } from 'react-router-dom';
import { Card, ErrorState, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { can, useMe } from '../authentication/session';
import { useAuditLogs, useDeletionRequests, useMemberCount, useTenantModules } from './api';

function Stat({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: string | number;
  to?: string;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-3xl font-semibold text-brand-800">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </>
  );
  return (
    <Card>
      {to ? (
        <Link to={to} className="block hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export function DashboardPage() {
  const me = useMe();
  const pending = useMemberCount('pending');
  const deletions = useDeletionRequests({ per_page: 1 });
  const modules = useTenantModules();
  const audit = useAuditLogs({ per_page: 5 });
  const tala = modules.data?.find((m) => m.code === 'tala');

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview of ${me.tenant.name}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Pending registrations"
          value={pending.isPending ? '…' : (pending.data ?? '—')}
          to="/app/members?status=pending"
          hint="Waiting for your approval"
        />
        <Stat
          label="Deletion requests"
          value={deletions.isPending ? '…' : (deletions.data?.meta.total ?? '—')}
          to="/app/deletion-requests"
          hint="Open requests from members"
        />
        <Card>
          <p className="text-sm font-medium">Tala module</p>
          <div className="mt-2">
            {modules.isPending ? (
              '…'
            ) : (
              <StatusBadge
                status={!tala?.entitled ? 'not provisioned' : tala.enabled ? 'enabled' : 'disabled'}
              />
            )}
          </div>
          <Link
            to="/app/modules"
            className="mt-2 inline-block text-xs text-accent-600 hover:underline"
          >
            Manage modules
          </Link>
        </Card>
      </div>
      {can(me, 'audit.view') && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Recent activity</h2>
          {audit.isPending ? (
            <Spinner />
          ) : audit.isError ? (
            <ErrorState message={describeError(audit.error)} onRetry={() => void audit.refetch()} />
          ) : (
            <AuditTable entries={audit.data.data} />
          )}
        </section>
      )}
    </>
  );
}
