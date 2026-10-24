import { Eye, FileUp, Pencil } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  DateField,
  EmptyState,
  ErrorState,
  FileDrop,
  FormDialog,
  FormError,
  IconButton,
  PageHeader,
  SelectField,
  SkeletonDataTable,
  Table,
  TextField,
  useToast,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { CrewDocument } from '../../services/api/types';
import {
  openMyFile,
  useMyDocumentRequests,
  useMyDocuments,
  useMyDocumentTypes,
  useSaveMyDocument,
  type DocumentFields,
  type DocumentView,
} from './api';
import { documentBadge, showDay } from './format';

const HEADERS = ['Document', 'Issued', 'Expires', 'Status', ''];
const CELLS: CellKind[] = ['stack', 'date', 'date', 'pill', 'actions2'];

/** Add a document, or correct one that is waiting or was sent back. The owner always comes from the session. */
function DocumentFormDialog({
  doc,
  presetType,
  onClose,
}: {
  doc?: CrewDocument;
  presetType?: string;
  onClose: () => void;
}) {
  const types = useMyDocumentTypes();
  const save = useSaveMyDocument(doc?.id);
  const toast = useToast();
  const [v, setV] = useState<DocumentFields>({
    document_type_id: doc?.type?.id ?? presetType ?? '',
    number: doc?.number ?? '',
    grade: doc?.grade ?? '',
    location: doc?.location ?? '',
    school: doc?.school ?? '',
    issued_on: doc?.issued_on ?? '',
    expires_on: doc?.expires_on ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<DocumentFields>) => setV((cur) => ({ ...cur, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.document_type_id) return setError('Choose the kind of document.');
    if (!doc && !file) return setError('Choose the file.');
    if (v.issued_on && v.expires_on && v.expires_on < v.issued_on)
      return setError('The expiry date cannot be before the date it was issued.');
    setError(null);
    try {
      await save.mutateAsync({ fields: doc ? { ...v, document_type_id: undefined } : v, file });
      toast.success(doc ? 'Document sent in again.' : 'Document sent in.');
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <FormDialog
      open
      wide
      title={doc ? 'Correct this document' : 'Add a document'}
      description="Your organization checks it, then approves it or sends it back with a reason."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <SelectField
          label="Kind of document"
          value={v.document_type_id}
          disabled={!!doc}
          onChange={(e) => set({ document_type_id: e.target.value })}
          options={[
            { value: '', label: types.isPending ? 'Loading…' : 'Choose…' },
            ...(types.data ?? []).map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Number"
            maxLength={80}
            value={v.number}
            onChange={(e) => set({ number: e.target.value })}
          />
          <TextField
            label="Grade"
            maxLength={80}
            value={v.grade}
            onChange={(e) => set({ grade: e.target.value })}
          />
          <TextField
            label="Place of issue"
            maxLength={120}
            value={v.location}
            onChange={(e) => set({ location: e.target.value })}
          />
          <TextField
            label="School"
            maxLength={120}
            value={v.school}
            onChange={(e) => set({ school: e.target.value })}
          />
          <DateField
            label="Date issued"
            value={v.issued_on}
            onChange={(d) => set({ issued_on: d })}
          />
          <DateField
            label="Date it expires"
            value={v.expires_on}
            onChange={(d) => set({ expires_on: d })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="portal-doc-file" className="text-sm font-medium">
            File {doc ? '(only to replace the current one)' : ''}
          </label>
          <FileDrop
            id="portal-doc-file"
            file={file}
            onFile={setFile}
            accept="application/pdf,image/jpeg,image/png"
            hint="A PDF, JPEG or PNG."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {doc ? 'Send in again' : 'Send in'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

/** The member's documents: what is approved (with its expiry), what is waiting or was sent back, and what the agency asked for. */
export function PortalFilesPage() {
  const [view, setView] = useState<DocumentView>('approved');
  const approved = useMyDocuments('approved');
  const review = useMyDocuments('review');
  const requests = useMyDocumentRequests();
  const toast = useToast();
  const [form, setForm] = useState<{ doc?: CrewDocument; type?: string } | null>(null);
  const list = view === 'approved' ? approved : review;
  const { expired = 0, expiring = 0 } = approved.data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Files"
        description="Your documents and what your organization checked."
        actions={<Button onClick={() => setForm({})}>Add a document</Button>}
      />

      {expired + expiring > 0 && (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-card)] border border-warn-fg/30 bg-warn-bg px-4 py-3 text-sm text-warn-fg"
        >
          {expired > 0 &&
            `${expired} ${expired === 1 ? 'document has' : 'documents have'} expired. `}
          {expiring > 0 &&
            `${expiring} ${expiring === 1 ? 'document expires' : 'documents expire'} soon.`}
        </p>
      )}

      {requests.data && requests.data.length > 0 && (
        <section aria-labelledby="asked-for" className="mb-6">
          <h2 id="asked-for" className="mb-3 text-base font-semibold">
            Your organization asked for
          </h2>
          <Table caption="Documents asked for" headers={['Document', 'Asked on', '']} compact>
            {requests.data.map((r) => (
              <tr key={r.type.id}>
                <td className="px-4 py-3 font-medium">{r.type.name}</td>
                <td className="whitespace-nowrap px-4 py-3">{showDay(r.requested_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <IconButton
                    icon={FileUp}
                    tone="primary"
                    label={`Send in ${r.type.name}`}
                    tip="Send it in"
                    onClick={() => setForm({ type: r.type.id })}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <div className="mb-4 max-w-xs">
        <SelectField
          label="Show"
          value={view}
          onChange={(e) => setView(e.target.value as DocumentView)}
          options={[
            {
              value: 'approved',
              label: `Approved${approved.data ? ` (${approved.data.data.length})` : ''}`,
            },
            {
              value: 'review',
              label: `Under review${review.data ? ` (${review.data.data.length})` : ''}`,
            },
          ]}
        />
      </div>

      {list.isPending ? (
        <SkeletonDataTable
          caption="Documents"
          headers={HEADERS}
          cells={CELLS}
          rows={4}
          label="Loading documents"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={
            view === 'approved' ? 'No approved documents yet' : 'Nothing is waiting for review'
          }
          description={
            view === 'approved' ? 'Add a document and your organization will check it.' : undefined
          }
        />
      ) : (
        <Table caption="Documents" headers={HEADERS}>
          {list.data.data.map((d) => {
            const badge = documentBadge(d);
            return (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{d.type?.name}</p>
                  <p className="text-xs text-muted">{d.number ?? '—'}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{showDay(d.issued_on)}</td>
                <td className="whitespace-nowrap px-4 py-3">{showDay(d.expires_on)}</td>
                <td className="px-4 py-3">
                  {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : '—'}
                  {d.status === 'rejected' && d.rejection_reason ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
                      {d.rejection_reason}
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon={Eye}
                      label={`View the file of ${d.type?.name}`}
                      tip="View file"
                      onClick={() =>
                        void openMyFile('documents', d.id).catch((e) =>
                          toast.error(describeError(e)),
                        )
                      }
                    />
                    {d.status !== 'approved' && (
                      <IconButton
                        icon={Pencil}
                        label={`Correct ${d.type?.name}`}
                        tip="Correct and send again"
                        onClick={() => setForm({ doc: d })}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {form ? (
        <DocumentFormDialog
          key={form.doc?.id ?? form.type ?? 'new'}
          doc={form.doc}
          presetType={form.type}
          onClose={() => setForm(null)}
        />
      ) : null}
    </>
  );
}
