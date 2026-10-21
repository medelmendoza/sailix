import { useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonTable,
  Table,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { formatDateTime } from '../shared/AuditTable';
import { useDeletionRequests } from './api';

export function DeletionRequestsPage() {
  const [page, setPage] = useState(1);
  const requests = useDeletionRequests({ page, per_page: 20 });

  return (
    <>
      <PageHeader
        title="Deletion requests"
        description="Members who asked for their account to be deleted."
      />
      <Card className="mb-4 bg-warn-bg text-sm text-warn-fg">
        Requests are recorded and listed here. Nothing is deleted automatically and the member keeps
        access until your organization and the platform decide how deletion is handled.
      </Card>
      {requests.isPending ? (
        <SkeletonTable columns={4} rows={6} label="Loading requests" />
      ) : requests.isError ? (
        <ErrorState
          message={describeError(requests.error)}
          onRetry={() => void requests.refetch()}
        />
      ) : requests.data.data.length === 0 ? (
        <EmptyState title="No open requests" />
      ) : (
        <>
          <Table caption="Deletion requests" headers={['Member', 'Account', 'Requested']}>
            {requests.data.data.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">
                  {[r.membership?.profile?.first_name, r.membership?.profile?.last_name]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <p>{r.membership?.user?.username}</p>
                  <p className="text-xs text-muted">{r.membership?.user?.email}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.requested_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination meta={requests.data.meta} onPage={setPage} />
        </>
      )}
    </>
  );
}
