import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  Pagination,
  Spinner,
  Table,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import { formatDateTime } from '../shared/AuditTable';
import { useAnnouncements, useDeleteAnnouncement, useSaveAnnouncement } from './api';

const schema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(150, 'At most 150 characters.'),
  body: z.string().trim().min(1, 'Write the announcement.').max(5000, 'At most 5000 characters.'),
  show_until: z.string(),
});
type Values = z.infer<typeof schema>;

function status(a: Announcement): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (!a.is_active) return { label: 'Switched off', tone: 'neutral' };
  if (a.expires_at && new Date(a.expires_at) <= new Date())
    return { label: 'Expired', tone: 'warning' };
  return { label: 'Live', tone: 'success' };
}

/** `YYYY-MM-DD` of the end date in the viewer's time zone, for the date input. */
function dateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const list = useAnnouncements({ page, per_page: 20 });
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const toast = useToast();
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  function toggle(a: Announcement) {
    save.mutate(
      { id: a.id, input: { is_active: !a.is_active } },
      {
        onSuccess: () =>
          toast.success(a.is_active ? 'Announcement switched off.' : 'Announcement is live.'),
        onError: (e) => toast.error(describeError(e)),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages every member of your organization sees in the mobile app."
        actions={<Button onClick={() => setEditing('new')}>New announcement</Button>}
      />
      <Card className="mb-4 text-sm text-muted">
        Everyone in your organization can read an announcement. It is plain text; attachments are
        not supported yet.
      </Card>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <>
          <Table
            caption="Announcements"
            headers={['Title', 'Status', 'Shown until', 'Written', '']}
          >
            {list.data.data.map((a) => {
              const s = status(a);
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted">{a.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {a.expires_at ? formatDateTime(a.expires_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(a)}
                        aria-label={`Edit ${a.title}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => toggle(a)}
                        aria-label={`${a.is_active ? 'Switch off' : 'Switch on'} ${a.title}`}
                      >
                        {a.is_active ? 'Switch off' : 'Switch on'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDeleting(a)}
                        aria-label={`Delete ${a.title}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}

      {editing ? (
        <AnnouncementForm
          key={editing === 'new' ? 'new' : editing.id}
          announcement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this announcement?"
        description="Members will no longer see it and its read history is removed. This cannot be undone. To hide it for now, switch it off instead."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function AnnouncementForm({
  announcement,
  onClose,
}: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const save = useSaveAnnouncement();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: announcement?.title ?? '',
      body: announcement?.body ?? '',
      show_until: dateInput(announcement?.expires_at ?? null),
    },
  });

  async function onSubmit(v: Values) {
    setFormError(null);
    try {
      await save.mutateAsync({
        id: announcement?.id,
        input: {
          title: v.title,
          body: v.body,
          // the end of the chosen day, in the administrator's own time zone
          expires_at: v.show_until ? new Date(`${v.show_until}T23:59:59`).toISOString() : null,
        },
      });
      toast.success(announcement ? 'Announcement saved.' : 'Announcement published.');
      onClose();
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['title', 'body']));
    }
  }

  return (
    <FormDialog
      open
      title={announcement ? 'Edit announcement' : 'New announcement'}
      description="Every active member of your organization can read it."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Title"
          maxLength={150}
          error={errors.title?.message}
          {...register('title')}
        />
        <TextAreaField
          label="Message"
          maxLength={5000}
          error={errors.body?.message}
          {...register('body')}
        />
        <TextField
          label="Show until (optional)"
          type="date"
          hint="It disappears from the app after this day. Leave empty to keep it up."
          error={errors.show_until?.message}
          {...register('show_until')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {announcement ? 'Save' : 'Publish'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
