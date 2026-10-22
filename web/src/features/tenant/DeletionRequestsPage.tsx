import { useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Table,
  SkeletonDataTable,
  type CellKind,
  Loadable,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { formatDateTime } from '../shared/AuditTable';
import { useDeletionRequests } from './api';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const REQUEST_HEADERS = ['Member', 'Account', 'Requested'];
const REQUEST_CELLS: CellKind[] = ['strong', 'stack', 'date'];

export function DeletionRequestsPage() {
  const [page, setPage] = useState(1);
  const requests = useDeletionRequests({ page, per_page: 20 });

  return (
    <>
      <PageHeader
        loading={requests.isPending}
        title="Deletion requests"
        description="Members who asked for their account to be deleted."
      />

      <Loadable loading={requests.isPending}>
        {' '}
        <Card className="mb-4 bg-warn-bg text-sm text-warn-fg">
          Requests are recorded and listed here. Nothing is deleted automatically and the member
          keeps access until your organization and the platform decide how deletion is handled.
        </Card>
      </Loadable>
      {requests.isPending ? (
        <SkeletonDataTable
          caption="Deletion requests"
          headers={REQUEST_HEADERS}
          cells={REQUEST_CELLS}
          rows={4}
          label="Loading requests"
        />
      ) : requests.isError ? (
        <ErrorState
          message={describeError(requests.error)}
          onRetry={() => void requests.refetch()}
        />
      ) : requests.data.data.length === 0 ? (
        <EmptyState title="No open requests" />
      ) : (
        <>
          <Table caption="Deletion requests" headers={REQUEST_HEADERS}>
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
