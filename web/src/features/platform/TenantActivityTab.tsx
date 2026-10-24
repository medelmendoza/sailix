import { useState } from 'react';
import { EmptyState, ErrorState, Pagination, SkeletonDataTable } from '../../components/ui';
import { AUDIT_CELLS, AUDIT_HEADERS, AuditTable } from '../shared/AuditTable';
import { describeError, usePlatformAudit } from './api';

/** What happened to this organization: the platform's audit log, filtered to it. */
export function TenantActivityTab({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const logs = usePlatformAudit({ page, per_page: 20, 'filter[tenant_id]': tenantId });

  if (logs.isPending)
    return (
      <SkeletonDataTable
        caption="Audit log"
        headers={AUDIT_HEADERS}
        cells={AUDIT_CELLS}
        rows={8}
        label="Loading activity"
      />
    );
  if (logs.isError)
    return <ErrorState message={describeError(logs.error)} onRetry={() => void logs.refetch()} />;
  if (logs.data.meta.total === 0)
    return (
      <EmptyState
        title="No activity recorded yet"
        description="Changes to this organization will appear here."
      />
    );
  return (
    <>
      <AuditTable entries={logs.data.data} />
      <Pagination meta={logs.data.meta} loading={logs.isFetching} onPage={setPage} />
    </>
  );
}
