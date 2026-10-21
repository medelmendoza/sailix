import { useState } from 'react';
import {
  Card,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonTable,
  TextField,
} from '../../components/ui';
import { AuditTable } from '../shared/AuditTable';
import { describeError, usePlatformAudit } from './api';

export function PlatformAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [tenantId, setTenantId] = useState('');
  const logs = usePlatformAudit({
    page,
    per_page: 20,
    'filter[action]': action || undefined,
    'filter[tenant_id]': tenantId || undefined,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Security and administrative events across the platform."
      />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Filter by action"
            placeholder="e.g. tenant.suspend"
            value={action}
            onChange={(e) => {
              setAction(e.target.value.trim());
              setPage(1);
            }}
          />
          <TextField
            label="Filter by organization ID"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value.trim());
              setPage(1);
            }}
          />
        </div>
      </Card>
      {logs.isPending ? (
        <SkeletonTable columns={4} rows={8} label="Loading audit log" />
      ) : logs.isError ? (
        <ErrorState message={describeError(logs.error)} onRetry={() => void logs.refetch()} />
      ) : (
        <>
          <AuditTable entries={logs.data.data} />
          <Pagination meta={logs.data.meta} onPage={setPage} />
        </>
      )}
    </>
  );
}
