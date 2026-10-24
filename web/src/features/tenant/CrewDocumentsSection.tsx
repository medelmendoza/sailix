import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Card,
  SkeletonField,
  EmptyState,
  ErrorState,
  SelectField,
  Table,
  TextField,
  SkeletonDataTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Crew, CrewDocumentRow } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { useCrewDocuments, useDocuments, useSetDocumentRequest } from './api';

/** The two tables' columns, shared with their loading placeholders so the two always have the same shape. */
export const CHECKLIST_HEADERS = ['Document', 'Number', 'Expires', 'Status', 'Ask'];
export const CHECKLIST_CELLS: CellKind[] = ['strong', 'text', 'date', 'pill', 'text'];
const UPLOAD_HEADERS = ['Document', 'Sent', ''];
const UPLOAD_CELLS: CellKind[] = ['stack', 'date', 'actions2'];

type State = CrewDocumentRow['state'];
const STATE: Record<State, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> =
  {
    valid: { label: 'Valid', tone: 'success' },
    expiring: { label: 'Expiring', tone: 'warning' },
    expired: { label: 'Expired', tone: 'danger' },
    none: { label: 'No expiry', tone: 'success' },
    pending: { label: 'Waiting for review', tone: 'warning' },
    rejected: { label: 'Sent back', tone: 'danger' },
    missing: { label: 'Not submitted', tone: 'neutral' },
  };

/** The assign grid while it loads: the checklist card at the left, the two filters and the table at the right. */
export function AssignDocumentsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="self-start">
        <h3 className="mb-2 text-sm font-semibold">Document checklist</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Seaman&apos;s Book</li>
          <li>Medical certificate</li>
        </ul>
      </Card>
      <div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <SkeletonField label="Document name" />
          </div>
          <div className="w-full sm:w-52">
            <SkeletonField label="Status" />
          </div>
        </div>
        <SkeletonDataTable
          caption="Documents to assign"
          headers={CHECKLIST_HEADERS}
          cells={CHECKLIST_CELLS}
          rows={6}
          label="Loading documents"
        />
      </div>
    </div>
  );
}

/** The whole Documents tab while it loads: both sections with their headings, the grid and the upload table. */
export function CrewDocumentsSkeleton() {
  return (
    <div role="status" aria-label="Loading documents">
      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Assign documents</h2>
        <p className="mb-3 text-sm text-muted">
          Tick a document to ask this member to submit or renew it. It leaves the checklist when
          they send one in.
        </p>
        <AssignDocumentsSkeleton />
      </section>
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Document upload requests</h2>
        <SkeletonDataTable
          caption="Documents waiting for review"
          headers={UPLOAD_HEADERS}
          cells={UPLOAD_CELLS}
          rows={2}
          label="Loading upload requests"
        />
      </section>
    </div>
  );
}

/** What an administrator does about a crew member's paperwork: ask for documents, and see what was just sent in. */
export function CrewDocumentsSection({ crew }: { crew: Crew }) {
  return (
    <>
      <AssignDocuments crew={crew} />
      <UploadRequests crew={crew} />
    </>
  );
}

function AssignDocuments({ crew }: { crew: Crew }) {
  const rows = useCrewDocuments(crew.id);
  const set = useSetDocumentRequest(crew.id);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const canAsk = crew.status === 'active';

  const all = rows.data ?? [];
  const shown = all.filter(
    (r) =>
      r.type.name.toLowerCase().includes(name.trim().toLowerCase()) &&
      (state === '' || r.state === state),
  );
  const asked = all.filter((r) => r.requested);

  return (
    <section aria-labelledby="assign-docs" className="mb-6">
      <h2 id="assign-docs" className="mb-1 text-base font-semibold">
        Assign documents
      </h2>
      <p className="mb-3 text-sm text-muted">
        Tick a document to ask this member to submit or renew it. It leaves the checklist when they
        send one in.
      </p>
      {rows.isPending ? (
        <AssignDocumentsSkeleton />
      ) : rows.isError ? (
        <ErrorState message={describeError(rows.error)} onRetry={() => void rows.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          title="No document types yet"
          description="Add the kinds of documents you track under Document types."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="self-start">
            <section aria-label="Document checklist">
              <h3 className="mb-2 text-sm font-semibold">Document checklist</h3>
              {asked.length === 0 ? (
                <p className="text-sm text-muted">Nothing asked for.</p>
              ) : (
                <ul className="list-disc pl-5 text-sm">
                  {asked.map((r) => (
                    <li key={r.type.id}>{r.type.name}</li>
                  ))}
                </ul>
              )}
            </section>
          </Card>
          <div>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-64">
                <TextField
                  label="Document name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-52">
                <SelectField
                  label="Status"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  options={[
                    { value: '', label: 'All statuses' },
                    ...(Object.keys(STATE) as State[]).map((k) => ({
                      value: k,
                      label: STATE[k].label,
                    })),
                  ]}
                />
              </div>
            </div>
            {shown.length === 0 ? (
              <EmptyState title="No documents match" />
            ) : (
              <Table caption="Documents to assign" headers={CHECKLIST_HEADERS}>
                {shown.map((r) => {
                  const s = STATE[r.state];
                  return (
                    <tr key={r.type.id}>
                      <td className="px-4 py-3 font-medium">{r.type.name}</td>
                      <td className="px-4 py-3">{r.document?.number ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.document?.expires_on ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {set.isPending && set.variables?.typeId === r.type.id ? (
                          // this row's request is on its way: a small ring where the box was
                          <span
                            role="status"
                            aria-label={`Saving ${r.type.name}`}
                            className="block size-4 animate-spin rounded-full border-2 border-brand-700 border-t-transparent motion-reduce:animate-[spin_2s_linear_infinite]"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={`Ask for ${r.type.name}`}
                            checked={r.requested}
                            disabled={!canAsk || set.isPending}
                            onChange={(e) =>
                              set.mutate({ typeId: r.type.id, requested: e.target.checked })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function UploadRequests({ crew }: { crew: Crew }) {
  const list = useDocuments({ membership_id: crew.id, status: 'pending', per_page: 50 });
  const count = list.data?.meta.total ?? 0;

  return (
    <section aria-labelledby="doc-uploads" className="mb-6">
      <h2 id="doc-uploads" className="mb-3 flex items-center gap-2 text-base font-semibold">
        Document upload requests
        {count > 0 ? <Badge tone="warning">{count}</Badge> : null}
      </h2>
      {list.isPending ? (
        <SkeletonDataTable
          caption="Documents waiting for review"
          headers={UPLOAD_HEADERS}
          cells={UPLOAD_CELLS}
          rows={2}
          label="Loading upload requests"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nothing waiting for review" />
      ) : (
        <Table caption="Documents waiting for review" headers={UPLOAD_HEADERS}>
          {list.data.data.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{d.type.name}</p>
                <p className="text-xs text-muted">{d.number ?? '—'}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3">{formatDateTime(d.submitted_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/app/documents?member=${crew.id}`}
                  aria-label={`Review ${d.type.name}`}
                  className="text-brand underline-offset-2 hover:underline"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
