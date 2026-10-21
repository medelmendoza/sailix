import { ErrorState, PageHeader, Spinner } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { usePlatformAudit } from './api';
import { TenantSummary } from './TenantSummary';

export function PlatformDashboardPage() {
  const audit = usePlatformAudit({ per_page: 8 });
  return (
    <>
      <PageHeader
        title="Platform dashboard"
        description="Organizations on the platform, and what happened lately."
      />
      <TenantSummary />
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
