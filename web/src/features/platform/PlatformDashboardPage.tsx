import { Link } from 'react-router-dom';
import { Card, ErrorState, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { usePlatformAudit, useTenantStatusCount } from './api';

const STATUSES = ['provisioning', 'active', 'suspended', 'deactivated', 'archived'] as const;

const DOT: Record<string, string> = {
  provisioning: 'bg-amber-500',
  active: 'bg-emerald-500',
  suspended: 'bg-orange-500',
  deactivated: 'bg-slate-400',
  archived: 'bg-slate-300',
};

function StatusCount({ status }: { status: string }) {
  const count = useTenantStatusCount(status);
  return (
    <Card>
      <Link to={`/platform/tenants?status=${status}`} className="block hover:underline">
        <div className="flex items-start justify-between gap-2">
          <p className="text-3xl font-semibold text-brand-800">
            {count.isPending ? '…' : (count.data ?? '—')}
          </p>
          <span
            aria-hidden="true"
            className={`mt-1 h-2.5 w-2.5 rounded-full ${DOT[status] ?? 'bg-line'}`}
          />
        </div>
        <div className="mt-2">
          <StatusBadge status={status} />
        </div>
      </Link>
    </Card>
  );
}

export function PlatformDashboardPage() {
  const audit = usePlatformAudit({ per_page: 8 });
  return (
    <>
      <PageHeader title="Platform dashboard" description="Organizations by lifecycle state." />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((s) => (
          <StatusCount key={s} status={s} />
        ))}
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Recent platform activity</h2>
        {audit.isPending ? (
          <Spinner />
        ) : audit.isError ? (
          <ErrorState message={describeError(audit.error)} onRetry={() => void audit.refetch()} />
        ) : (
          <AuditTable entries={audit.data.data} />
        )}
      </section>
    </>
  );
}
