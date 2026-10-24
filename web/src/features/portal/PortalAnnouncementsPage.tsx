import { Eye, Paperclip } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  FileTile,
  FormDialog,
  IconButton,
  PageHeader,
  Pagination,
  SearchField,
  SkeletonDataTable,
  Table,
  fileSize,
  useToast,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement } from '../../services/api/types';
import { openMyFile, useMarkAnnouncementRead, useMyAnnouncements } from './api';
import { showDay } from './format';

const PER_PAGE = 10;
const HEADERS = ['Title', 'Date', ''];
const CELLS: CellKind[] = ['strong', 'date', 'actions1'];

/** One announcement, read in full. Opening it marks it read. */
export function AnnouncementDialog({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  const toast = useToast();
  const att = announcement.attachment;
  return (
    <FormDialog
      open
      title={announcement.title}
      description={showDay(announcement.created_at)}
      onClose={onClose}
    >
      {/* plain text, shown as text (never as HTML), with its line breaks */}
      <p className="whitespace-pre-wrap text-sm">{announcement.body}</p>
      {att ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <FileTile contentType={att.type} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5">{att.name}</p>
            <p className="text-xs leading-4 text-muted">{fileSize(att.size)}</p>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              void openMyFile('announcements', announcement.id).catch((e) =>
                toast.error(describeError(e)),
              )
            }
          >
            Open
          </Button>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </FormDialog>
  );
}

/** What the organization told its crew, as the same kind of table the admin portal uses: newest first, unread ones marked, searched and paged on the server. */
export function PortalAnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const list = useMyAnnouncements({
    page,
    per_page: PER_PAGE,
    ...(title ? { 'filter[title]': title } : {}),
  });
  const markRead = useMarkAnnouncementRead();
  const [open, setOpen] = useState<Announcement | null>(null);

  function view(a: Announcement) {
    setOpen(a);
    if (a.is_read === false) void markRead(a.id);
  }

  return (
    <>
      <PageHeader title="Announcements" description="Messages from your organization." />
      <div className="mb-4 max-w-sm">
        <SearchField
          label="Search announcements"
          placeholder="Search by title"
          value={title}
          onSearch={(v) => {
            setTitle(v);
            setPage(1);
          }}
        />
      </div>
      {list.isPending ? (
        <SkeletonDataTable
          caption="Announcements"
          headers={HEADERS}
          cells={CELLS}
          rows={5}
          label="Loading announcements"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={title ? 'No announcement matches' : 'No announcements yet'}
          description={title ? undefined : 'Messages from your organization show up here.'}
        />
      ) : (
        <>
          <Table caption="Announcements" headers={HEADERS}>
            {list.data.data.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    {a.is_read === false && (
                      <span
                        aria-label="Unread"
                        className="size-2.5 shrink-0 rounded-full bg-accent-600"
                      />
                    )}
                    {a.title}
                    {a.attachment ? (
                      <Paperclip className="size-4 shrink-0 text-muted" aria-label="Has a file" />
                    ) : null}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{showDay(a.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <IconButton
                    icon={Eye}
                    label={`Read ${a.title}`}
                    tip="Read"
                    onClick={() => view(a)}
                  />
                </td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} loading={list.isFetching} onPage={setPage} />
        </>
      )}
      {open ? <AnnouncementDialog announcement={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
