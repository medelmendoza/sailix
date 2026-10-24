import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  FileTile,
  FormDialog,
  PageHeader,
  Pagination,
  Skeleton,
  fileSize,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement } from '../../services/api/types';
import { openMyFile, useMarkAnnouncementRead, useMyAnnouncements } from './api';
import { showDay } from './format';

const PER_PAGE = 10;

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

/** What the organization told its crew: newest first, the unread ones marked. */
export function PortalAnnouncementsPage() {
  const [page, setPage] = useState(1);
  const list = useMyAnnouncements({ page, per_page: PER_PAGE });
  const markRead = useMarkAnnouncementRead();
  const [open, setOpen] = useState<Announcement | null>(null);

  function view(a: Announcement) {
    setOpen(a);
    if (a.is_read === false) void markRead(a.id);
  }

  return (
    <>
      <PageHeader title="Announcements" description="Messages from your organization." />
      {list.isPending ? (
        <div role="status" aria-label="Loading announcements" className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex h-5 items-center">
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="mt-1 flex h-4 items-center">
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="mt-2 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Messages from your organization show up here."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {list.data.data.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => view(a)}
                  aria-label={`Read ${a.title}`}
                  className="card-hover w-full rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-[var(--shadow-soft)]"
                >
                  <span className="flex items-center gap-2">
                    {a.is_read === false && (
                      <span
                        aria-label="Unread"
                        className="size-2.5 shrink-0 rounded-full bg-accent-600"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate font-heading text-base font-bold">
                      {a.title}
                    </span>
                    {a.attachment ? (
                      <Paperclip className="size-4 shrink-0 text-muted" aria-label="Has a file" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{showDay(a.created_at)}</span>
                  <span className="mt-2 line-clamp-2 block text-sm">{a.body}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination meta={list.data.meta} loading={list.isFetching} onPage={setPage} />
        </>
      )}
      {open ? <AnnouncementDialog announcement={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
