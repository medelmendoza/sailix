import { Button, FormDialog, useToast } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { openAnnouncementFile } from './api';

/** Who an announcement is for, in words. */
export const audienceText = (a: Pick<Announcement, 'fleets'>) =>
  a.fleets && a.fleets.length > 0 ? a.fleets.join(', ') : 'Everyone';

const KB = 1024;
const sizeText = (bytes: number) =>
  bytes >= KB * KB
    ? `${(bytes / KB / KB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / KB))} KB`;

/** A read-only view of one announcement: who it is for, who wrote it, when, the message and its file. */
export function AnnouncementDetails({
  announcement: a,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  const toast = useToast();

  async function open() {
    try {
      await openAnnouncementFile(a.id);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  const rows: Array<[string, string]> = [
    ['Recipients', audienceText(a)],
    ['Author', a.author?.name ?? '—'],
    ['Date', formatDateTime(a.created_at)],
  ];

  return (
    <FormDialog open title="Announcement details" onClose={onClose}>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <dt className="text-muted">Title</dt>
        {/* written by an administrator: shown as text, never as HTML */}
        <dd className="font-medium">{a.title}</dd>
        <dt className="text-muted">Message</dt>
        <dd className="whitespace-pre-wrap rounded-md border border-line bg-page p-3">{a.body}</dd>
        <dt className="text-muted">Attachment</dt>
        <dd>
          {a.attachment ? (
            <Button variant="secondary" onClick={() => void open()}>
              Open {a.attachment.name} ({sizeText(a.attachment.size)})
            </Button>
          ) : (
            '—'
          )}
        </dd>
      </dl>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </FormDialog>
  );
}
