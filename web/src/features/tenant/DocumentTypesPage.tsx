import { useState } from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  Table,
  TextField,
  useToast,
  SkeletonDataTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { DocumentType } from '../../services/api/types';
import { useDeleteDocumentType, useDocumentTypes, useSaveDocumentType } from './api';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const TYPE_HEADERS = ['Name', 'Short name', 'Status', ''];
const TYPE_CELLS: CellKind[] = ['strong', 'text', 'pill', 'actions3'];

export function DocumentTypesPage() {
  const list = useDocumentTypes();
  const save = useSaveDocumentType();
  const remove = useDeleteDocumentType();
  const toast = useToast();
  const [editing, setEditing] = useState<DocumentType | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DocumentType | null>(null);

  function toggle(t: DocumentType) {
    save.mutate(
      { id: t.id, input: { is_active: !t.is_active } },
      {
        onSuccess: () => toast.success(t.is_active ? 'Switched off.' : 'Switched on.'),
        onError: (e) => toast.error(describeError(e)),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Document types"
        description="The kinds of document your members can submit (passport, seaman's book, medical...)."
        actions={<Button onClick={() => setEditing('new')}>New document type</Button>}
      />
      {list.isPending ? (
        <SkeletonDataTable
          caption="Document types"
          headers={TYPE_HEADERS}
          cells={TYPE_CELLS}
          rows={6}
          label="Loading document types"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No document types yet" />
      ) : (
        <Table caption="Document types" headers={TYPE_HEADERS}>
          {list.data.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3">{t.short_name ?? '—'}</td>
              <td className="px-4 py-3">
                <Badge tone={t.is_active ? 'success' : 'neutral'}>
                  {t.is_active ? 'In use' : 'Switched off'}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => setEditing(t)}
                    aria-label={`Edit ${t.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => toggle(t)}
                    aria-label={`${t.is_active ? 'Switch off' : 'Switch on'} ${t.name}`}
                  >
                    {t.is_active ? 'Switch off' : 'Switch on'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleting(t)}
                    aria-label={`Delete ${t.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {editing ? (
        <TypeForm
          key={editing === 'new' ? 'new' : editing.id}
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this document type?"
        description="A type that members' documents use cannot be deleted; switch it off instead."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })
        }
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function TypeForm({ type, onClose }: { type: DocumentType | null; onClose: () => void }) {
  const save = useSaveDocumentType();
  const toast = useToast();
  const [name, setName] = useState(type?.name ?? '');
  const [short, setShort] = useState(type?.short_name ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a name.');
    setError(null);
    try {
      await save.mutateAsync({
        id: type?.id,
        input: { name: name.trim(), short_name: short.trim() || null },
      });
      toast.success('Document type saved.');
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <FormDialog open title={type ? 'Edit document type' : 'New document type'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label="Name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Short name (optional)"
          maxLength={40}
          value={short}
          onChange={(e) => setShort(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
