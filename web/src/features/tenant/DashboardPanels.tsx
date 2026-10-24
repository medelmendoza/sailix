import { ArrowUpRight, ClipboardCheck, Eye } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  IconButton,
  IconLink,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  SkeletonDataTable,
  Table,
  TextField,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Announcement, Crew } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { AnnouncementDetails } from './AnnouncementDetails';
import { CreateCrewAccountDialog } from './CreateCrewAccount';
import { DASHBOARD_PANEL_SIZE, useAnnouncements, useCrewList, useDocuments } from './api';

const PER_PANEL = DASHBOARD_PANEL_SIZE;

/** A working panel of the dashboard: a title with a count and a link to the full list, then a short list and its own paging. */
function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = `panel-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section
      aria-labelledby={id}
      className="h-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
          {title}
          {count ? (
            <span
              aria-label={`${count} waiting`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-warn-bg px-2 text-xs font-bold text-warn-fg"
            >
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const headerLink =
  'rounded-full border border-line px-3 py-1 text-xs font-medium transition-colors hover:border-brand-600 hover:text-brand-800';

/** The panels' columns, shared with their loading placeholders so the two always have the same shape. */
const APPLICATION_HEADERS = ['Name', 'Crew ID', 'Rank', 'Fleet', ''];
const APPLICATION_CELLS: CellKind[] = ['strong', 'text', 'text', 'text', 'text'];
const DOCUMENT_HEADERS = ['Name', 'Crew ID', 'Document', ''];
const DOCUMENT_CELLS: CellKind[] = ['strong', 'text', 'text', 'text'];
const ANNOUNCEMENT_HEADERS = ['Title', 'Date', 'Author', 'Status', ''];
const ANNOUNCEMENT_CELLS: CellKind[] = ['strong', 'date', 'text', 'pill', 'text'];

const nameOf = (
  profile: { first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback: string,
) => [profile?.last_name, profile?.first_name].filter(Boolean).join(', ') || fallback;

/** Crew who registered and wait for approval. */
export function UserApplicationPanel() {
  const [typed, setTyped] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [applicant, setApplicant] = useState<Crew | null>(null);
  const list = useCrewList({
    'filter[status]': 'pending',
    page,
    per_page: PER_PANEL,
    ...(name ? { 'filter[name]': name } : {}),
  });

  return (
    <Panel
      title="User application"
      count={name ? undefined : list.data?.meta.total}
      action={
        <Link to="/app/members?status=pending" className={headerLink}>
          Open full list
        </Link>
      }
    >
      <form
        role="search"
        aria-label="Search applications"
        className="mb-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setName(typed.trim());
          setPage(1);
        }}
      >
        <div className="flex-1">
          <TextField
            label="Name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={100}
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setTyped('');
            setName('');
            setPage(1);
          }}
        >
          Clear
        </Button>
      </form>
      {list.isPending ? (
        <SkeletonDataTable
          compact
          caption="Applications waiting"
          headers={APPLICATION_HEADERS}
          cells={APPLICATION_CELLS}
          rows={PER_PANEL}
          label="Loading applications"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title={name ? 'No one matches' : 'No applications waiting'} />
      ) : (
        <>
          <Table compact caption="Applications waiting" headers={APPLICATION_HEADERS}>
            {list.data.data.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">
                  {/* opens the Create Crew Account screens for this applicant */}
                  <button
                    type="button"
                    onClick={() => setApplicant(c)}
                    className="text-left text-brand-800 underline-offset-2 hover:underline"
                  >
                    {nameOf(c, c.username)}
                  </button>
                </td>
                <td className="px-4 py-3">{c.crew_number ?? '—'}</td>
                <td className="px-4 py-3">{c.rank ?? '—'}</td>
                <td className="px-4 py-3">{c.fleet ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <IconLink
                    to={`/app/crew/${c.id}`}
                    icon={ArrowUpRight}
                    label={`See details of ${nameOf(c, c.username)}`}
                    tip="See details"
                  />
                </td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
      {applicant ? (
        <CreateCrewAccountDialog
          applicant={{ firstName: applicant.first_name ?? '', lastName: applicant.last_name ?? '' }}
          onClose={() => setApplicant(null)}
        />
      ) : null}
    </Panel>
  );
}

/** Documents members sent in, waiting for the agency's decision. */
export function DocumentApprovalPanel() {
  const [page, setPage] = useState(1);
  const list = useDocuments({ status: 'pending', page, per_page: PER_PANEL });

  return (
    <Panel
      title="Document approval"
      count={list.data?.meta.total}
      action={
        <Link to="/app/documents" className={headerLink}>
          Open full list
        </Link>
      }
    >
      {list.isPending ? (
        <SkeletonDataTable
          compact
          caption="Documents waiting"
          headers={DOCUMENT_HEADERS}
          cells={DOCUMENT_CELLS}
          rows={PER_PANEL}
          label="Loading documents"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nothing waiting for review" />
      ) : (
        <>
          <Table compact caption="Documents waiting" headers={DOCUMENT_HEADERS}>
            {list.data.data.map((d) => {
              const who = nameOf(d.owner?.profile, d.owner?.user?.username ?? '—');
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{who}</td>
                  <td className="px-4 py-3">{d.owner?.profile?.crew_number ?? '—'}</td>
                  <td className="px-4 py-3">{d.type.name}</td>
                  <td className="px-4 py-3 text-right">
                    <IconLink
                      to={`/app/documents?member=${d.owner?.id ?? ''}`}
                      icon={ClipboardCheck}
                      label={`Review ${d.type.name} of ${who}`}
                      tip="Review"
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

/** The latest announcements, newest first. */
export function AnnouncementsPanel() {
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Announcement | null>(null);
  const list = useAnnouncements({ page, per_page: PER_PANEL });

  return (
    <Panel
      title="Announcements"
      action={
        <Link to="/app/announcements" className={headerLink}>
          Write or manage
        </Link>
      }
    >
      {list.isPending ? (
        <SkeletonDataTable
          compact
          caption="Latest announcements"
          headers={ANNOUNCEMENT_HEADERS}
          cells={ANNOUNCEMENT_CELLS}
          rows={PER_PANEL}
          label="Loading announcements"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <>
          <Table compact caption="Latest announcements" headers={ANNOUNCEMENT_HEADERS}>
            {list.data.data.map((a) => (
              <tr key={a.id}>
                {/* written by an administrator: shown as text, never as HTML */}
                <td className="px-4 py-3 font-medium">{a.title}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.created_at)}</td>
                <td className="px-4 py-3">{a.author?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={a.is_active ? 'success' : 'neutral'}>
                    {a.is_active ? 'Showing' : 'Hidden'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <IconButton
                    icon={Eye}
                    label={`View ${a.title}`}
                    tip="View"
                    onClick={() => setViewing(a)}
                  />
                </td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
      {viewing ? (
        <AnnouncementDetails announcement={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </Panel>
  );
}

/**
 * The dashboard's panels in their grid: applications across the top, documents and announcements side by side below. While `loading` they are drawn as empty frames with shimmering rows of the same
 * shape, so the page does not rearrange itself when the real ones take their place.
 */
export function DashboardPanels({
  loading,
  crew,
  documents,
  announcements,
}: {
  loading: boolean;
  crew: boolean;
  documents: boolean;
  announcements: boolean;
}) {
  const shell = (title: string, headers: string[], cells: CellKind[]) => (
    <Panel title={title}>
      <SkeletonDataTable
        compact
        caption={title}
        headers={headers}
        cells={cells}
        rows={PER_PANEL}
        label={`Loading ${title.toLowerCase()}`}
      />
    </Panel>
  );
  return (
    // applications get a whole row; documents and announcements share the next one (each takes it alone when the other is off)
    <div className="grid gap-6 xl:grid-cols-2">
      {crew && (
        <div className="min-w-0 xl:col-span-2">
          {loading ? (
            shell('User application', APPLICATION_HEADERS, APPLICATION_CELLS)
          ) : (
            <UserApplicationPanel />
          )}
        </div>
      )}
      {documents && (
        <div className={`min-w-0 ${announcements ? '' : 'xl:col-span-2'}`}>
          {loading ? (
            shell('Document approval', DOCUMENT_HEADERS, DOCUMENT_CELLS)
          ) : (
            <DocumentApprovalPanel />
          )}
        </div>
      )}
      {announcements && (
        <div className={`min-w-0 ${documents ? '' : 'xl:col-span-2'}`}>
          {loading ? (
            shell('Announcements', ANNOUNCEMENT_HEADERS, ANNOUNCEMENT_CELLS)
          ) : (
            <AnnouncementsPanel />
          )}
        </div>
      )}
    </div>
  );
}
