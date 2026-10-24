import { zodResolver } from '@hookform/resolvers/zod';
import { X, Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  IconButton,
  FileDrop,
  FileTile,
  fileSize,
  DateField,
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
  Table,
  TextAreaField,
  TextField,
  useToast,
  SkeletonDataTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import { formatDateTime } from '../shared/AuditTable';
import { AnnouncementDetails, audienceText } from './AnnouncementDetails';
import { useMe } from '../authentication/session';
import {
  attachAnnouncementFile,
  removeAnnouncementFile,
  useAnnouncements,
  useCrewFleets,
  useDeleteAnnouncement,
  useSaveAnnouncement,
} from './api';
import { useQueryClient } from '@tanstack/react-query';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const ANNOUNCEMENT_HEADERS = ['Title', 'Recipients', 'Status', 'Shown until', 'Written', ''];
const ANNOUNCEMENT_CELLS: CellKind[] = ['stack', 'text', 'pill', 'date', 'date', 'actions3'];

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
  const [viewing, setViewing] = useState<Announcement | null>(null);

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
        description="Messages your members see in the mobile app: everyone, or only chosen fleets."
        actions={<Button onClick={() => setEditing('new')}>New announcement</Button>}
      />
      <Card className="mb-4 text-sm text-muted">
        An announcement is plain text and can carry one PDF or image. Choose Everyone, or tick the
        fleets it is for; a member sees it when their crew record names one of those fleets.
      </Card>
      {list.isPending ? (
        <SkeletonDataTable
          caption="Announcements"
          headers={ANNOUNCEMENT_HEADERS}
          cells={ANNOUNCEMENT_CELLS}
          rows={5}
          label="Loading announcements"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <>
          <Table caption="Announcements" headers={ANNOUNCEMENT_HEADERS}>
            {list.data.data.map((a) => {
              const s = status(a);
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted">{a.body}</p>
                    {a.attachment ? (
                      <p className="mt-1 text-xs text-muted">Attachment: {a.attachment.name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{audienceText(a)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {a.expires_at ? formatDateTime(a.expires_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon={Eye}
                        label={`View ${a.title}`}
                        tip="View"
                        onClick={() => setViewing(a)}
                      />
                      <IconButton
                        icon={Pencil}
                        label={`Edit ${a.title}`}
                        tip="Edit"
                        onClick={() => setEditing(a)}
                      />
                      <IconButton
                        icon={a.is_active ? PowerOff : Power}
                        label={`${a.is_active ? 'Switch off' : 'Switch on'} ${a.title}`}
                        tip={a.is_active ? 'Switch off' : 'Switch on'}
                        onClick={() => toggle(a)}
                      />
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${a.title}`}
                        tip="Delete"
                        tone="danger"
                        onClick={() => setDeleting(a)}
                      />
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

      {viewing ? (
        <AnnouncementDetails announcement={viewing} onClose={() => setViewing(null)} />
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
  const qc = useQueryClient();
  const me = useMe();
  const fleets = useCrewFleets();
  const [formError, setFormError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set(announcement?.fleets ?? []));
  const [file, setFile] = useState<File | null>(null);
  const [dropFile, setDropFile] = useState(false);
  const author =
    announcement?.author?.name ??
    ([me.profile?.first_name, me.profile?.last_name].filter(Boolean).join(' ') || me.user.username);
  const known = new Set(fleets.data ?? []);
  const options = [...known, ...[...chosen].filter((f) => !known.has(f))].sort((x, y) =>
    x.localeCompare(y),
  );
  const {
    register,
    control,
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

  function toggleFleet(f: string) {
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  async function onSubmit(v: Values) {
    setFormError(null);
    let saved: Announcement;
    try {
      saved = await save.mutateAsync({
        id: announcement?.id,
        input: {
          title: v.title,
          body: v.body,
          // the end of the chosen day, in the administrator's own time zone
          expires_at: v.show_until ? new Date(`${v.show_until}T23:59:59`).toISOString() : null,
          fleets: [...chosen],
        },
      });
    } catch (e) {
      return setFormError(applyServerErrors(e, setError, ['title', 'body']));
    }
    // the file goes up after the text is saved; if that fails the announcement still exists and can be edited
    try {
      if (file) await attachAnnouncementFile(saved.id, file);
      else if (dropFile) await removeAnnouncementFile(saved.id);
      void qc.invalidateQueries({ queryKey: ['announcements'] });
    } catch (e) {
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      return setFormError(
        `The announcement was saved, but its file was not: ${describeError(e)} Edit it to try again.`,
      );
    }
    toast.success(announcement ? 'Announcement saved.' : 'Announcement published.');
    onClose();
  }

  return (
    <FormDialog
      open
      title={announcement ? 'Edit announcement' : 'Create new announcement'}
      description="Choose who it is for, then write it."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Recipients</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="audience"
              checked={chosen.size === 0}
              onChange={() => setChosen(new Set())}
            />
            Everyone
          </label>
          {fleets.isPending ? null : options.length === 0 ? (
            <p className="text-xs text-muted">
              No fleets are recorded yet. Set a fleet on a crew profile to address announcements to
              it.
            </p>
          ) : (
            <div className="max-h-40 overflow-auto rounded-md border border-line p-2">
              {options.map((f) => (
                <label key={f} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" checked={chosen.has(f)} onChange={() => toggleFleet(f)} />
                  {f}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <TextField label="Author" value={author} readOnly disabled />
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
        <Controller
          name="show_until"
          control={control}
          render={({ field }) => (
            <DateField
              label="Show until (optional)"
              hint="It disappears from the app after this day. Leave empty to keep it up."
              error={errors.show_until?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="announcement-file" className="text-sm font-medium">
            Attached file (optional)
          </label>
          {announcement?.attachment && !file && !dropFile ? (
            // the file it already has: shown as a card, with a way to take it off
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <FileTile contentType={announcement.attachment.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5">
                  {announcement.attachment.name}
                </p>
                <p className="text-xs leading-4 text-muted">
                  Current file · {fileSize(announcement.attachment.size)}
                </p>
              </div>
              <button
                type="button"
                title="Remove the current file"
                aria-label="Remove the current file"
                onClick={() => setDropFile(true)}
                className="rounded-full p-2 text-muted transition-colors hover:bg-bad-bg hover:text-bad-fg"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {dropFile ? (
                <p className="text-xs text-muted">
                  The current file will be removed.{' '}
                  <button
                    type="button"
                    className="text-brand-700 underline"
                    onClick={() => setDropFile(false)}
                  >
                    Keep it
                  </button>
                </p>
              ) : null}
              <FileDrop
                id="announcement-file"
                file={file}
                onFile={setFile}
                accept="application/pdf,image/jpeg,image/png"
                hint="A PDF, JPEG or PNG."
              />
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {announcement ? 'Save' : 'Send'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
