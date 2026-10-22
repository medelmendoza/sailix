import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  Pagination,
  SelectField,
  Table,
  TextAreaField,
  useToast,
  SkeletonDataTable,
  type CellKind,
  Loadable,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { CrewDocument } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { openDocumentFile, useDocuments, useReviewDocument } from './api';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const DOCUMENT_HEADERS = ['Member', 'Document', 'Expires', 'Status', ''];
const DOCUMENT_CELLS: CellKind[] = ['stack', 'stack3', 'stack', 'pill', 'actions3'];

const STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Waiting for review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Sent back', tone: 'danger' },
};
const EXPIRY: Record<string, string> = {
  expired: 'Expired',
  expiring: 'Expiring soon',
  valid: 'Valid',
  none: '—',
};

export function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  // `?member=<id>` narrows the list to one crew member (the crew profile links here)
  const [search] = useSearchParams();
  const member = search.get('member');
  const list = useDocuments({
    page,
    per_page: 20,
    ...(status ? { status } : {}),
    ...(member ? { membership_id: member } : {}),
  });
  const review = useReviewDocument();
  const toast = useToast();
  const [approving, setApproving] = useState<CrewDocument | null>(null);
  const [rejecting, setRejecting] = useState<CrewDocument | null>(null);

  async function view(d: CrewDocument) {
    try {
      await openDocumentFile(d.id);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <>
      <PageHeader
        loading={list.isPending}
        title="Documents"
        description="Documents your members submitted. Check the file, then approve it or send it back with a reason."
      />

      <Loadable loading={list.isPending}>
        {' '}
        {member ? (
          <p className="mb-4 text-sm">
            Showing one member's documents.{' '}
            <Link to="/app/documents" className="text-brand underline-offset-2 hover:underline">
              Show everyone
            </Link>
          </p>
        ) : null}
        <div className="mb-4 max-w-xs">
          <SelectField
            label="Show"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'pending', label: 'Waiting for review' },
              { value: 'rejected', label: 'Sent back' },
              { value: 'approved', label: 'Approved' },
              { value: '', label: 'All' },
            ]}
          />
        </div>
      </Loadable>
      {list.isPending ? (
        <SkeletonDataTable
          caption="Documents"
          headers={DOCUMENT_HEADERS}
          cells={DOCUMENT_CELLS}
          rows={5}
          label="Loading documents"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No documents here" />
      ) : (
        <>
          <Table caption="Documents" headers={DOCUMENT_HEADERS}>
            {list.data.data.map((d) => {
              const s = STATUS[d.status] ?? STATUS.pending!;
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.owner?.user?.username}</p>
                    <p className="text-xs text-muted">{d.owner?.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.type.name}</p>
                    <p className="text-xs text-muted">{d.number ?? '—'}</p>
                    <p className="text-xs text-muted">Sent {formatDateTime(d.submitted_at)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {d.expires_on ?? '—'}
                    <p className="text-xs text-muted">{EXPIRY[d.expiry_status]}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {d.rejection_reason ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
                        {d.rejection_reason}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => void view(d)}
                        aria-label={`View file of ${d.type.name} for ${d.owner?.user?.username}`}
                      >
                        View file
                      </Button>
                      {d.status === 'pending' ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => setApproving(d)}
                            aria-label={`Approve ${d.type.name} for ${d.owner?.user?.username}`}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setRejecting(d)}
                            aria-label={`Send back ${d.type.name} for ${d.owner?.user?.username}`}
                          >
                            Send back
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={approving !== null}
        title="Approve this document?"
        description="It appears in the member's Files as an approved document. They can no longer edit it."
        confirmLabel="Approve"
        loading={review.isPending}
        onConfirm={() =>
          approving &&
          review.mutate(
            { id: approving.id },
            {
              onSuccess: () => {
                toast.success('Document approved.');
                setApproving(null);
              },
              onError: (e) => toast.error(describeError(e)),
            },
          )
        }
        onCancel={() => setApproving(null)}
      />
      {rejecting ? <RejectForm doc={rejecting} onClose={() => setRejecting(null)} /> : null}
    </>
  );
}

function RejectForm({ doc, onClose }: { doc: CrewDocument; onClose: () => void }) {
  const review = useReviewDocument();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError('Tell the member what to fix.');
    setError(null);
    try {
      await review.mutateAsync({ id: doc.id, reason: reason.trim() });
      toast.success('Document sent back.');
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <FormDialog
      open
      title="Send this document back"
      description="The member sees your reason and can send a corrected file."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextAreaField
          label="Reason"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={review.isPending}>
            Send back
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
