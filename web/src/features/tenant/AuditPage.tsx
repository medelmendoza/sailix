import { useState } from 'react';
import { ErrorState, PageHeader, Pagination, SkeletonTable, TextField } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { useAuditLogs } from './api';

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const logs = useAuditLogs({ page, per_page: 20, 'filter[action]': action || undefined });

  return (
    <>
      <PageHeader title="Audit log" description="Who changed what in your organization." />
      <div className="mb-4 max-w-sm">
        <TextField
          label="Filter by action"
          placeholder="e.g. membership.updated"
          value={action}
          onChange={(e) => {
            setAction(e.target.value.trim());
            setPage(1);
          }}
        />
      </div>
      {logs.isPending ? (
        <SkeletonTable columns={4} rows={6} label="Loading audit log" />
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
