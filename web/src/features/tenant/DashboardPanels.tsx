import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Spinner,
  Table,
  TextField,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { formatDateTime } from '../shared/AuditTable';
import { useAnnouncements, useCrewList, useDocuments } from './api';

const PER_PANEL = 5;

/** A working panel of the dashboard: a coloured title bar with a count, then a short list and its own paging. */
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
      className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 bg-brand-700 px-4 py-3 text-white">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold">
          {title}
          {count ? (
            <span
              aria-label={`${count} waiting`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-bad-fg"
            >
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const headerLink =
  'rounded-md bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25';

const nameOf = (
  profile: { first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback: string,
) => [profile?.last_name, profile?.first_name].filter(Boolean).join(', ') || fallback;

/** Crew who registered and wait for approval. */
export function UserApplicationPanel() {
  const [typed, setTyped] = useState('');
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
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
        <Spinner label="Loading applications" />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title={name ? 'No one matches' : 'No applications waiting'} />
      ) : (
        <>
          <Table
            compact
            caption="Applications waiting"
            headers={['Name', 'Crew ID', 'Rank', 'Fleet', '']}
          >
            {list.data.data.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{nameOf(c, c.username)}</td>
                <td className="px-4 py-3">{c.crew_number ?? '—'}</td>
                <td className="px-4 py-3">{c.rank ?? '—'}</td>
                <td className="px-4 py-3">{c.fleet ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/app/crew/${c.id}`}
                    aria-label={`See details of ${nameOf(c, c.username)}`}
                    className="text-brand-700 underline-offset-2 hover:underline"
                  >
                    See details
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
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
        <Spinner label="Loading documents" />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="Nothing waiting for review" />
      ) : (
        <>
          <Table compact caption="Documents waiting" headers={['Name', 'Crew ID', 'Document', '']}>
            {list.data.data.map((d) => {
              const who = nameOf(d.owner?.profile, d.owner?.user?.username ?? '—');
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{who}</td>
                  <td className="px-4 py-3">{d.owner?.profile?.crew_number ?? '—'}</td>
                  <td className="px-4 py-3">{d.type.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/app/documents?member=${d.owner?.id ?? ''}`}
                      aria-label={`Review ${d.type.name} of ${who}`}
                      className="text-brand-700 underline-offset-2 hover:underline"
                    >
                      Review
                    </Link>
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
        <Spinner label="Loading announcements" />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <>
          <Table
            compact
            caption="Latest announcements"
            headers={['Title', 'Date', 'Author', 'Status']}
          >
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
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
