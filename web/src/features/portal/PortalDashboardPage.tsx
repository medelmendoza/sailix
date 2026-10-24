import { Anchor, Eye, FileUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  IconLink,
  PageHero,
  Pagination,
  Skeleton,
  SkeletonDataTable,
  StatTile,
  Table,
  TextField,
} from '../../components/ui';
import { ICONS } from '../../components/icons';
import { hasFeature, useMe } from '../authentication/session';
import { PANEL_BODY, Panel, headerLink } from '../tenant/DashboardPanels';

import { useMyAnnouncements, useMyDocumentRequests, useMyDocuments, useMyTodos } from './api';
import { isOverdue, showDay } from './format';

const figure = (v?: number) => (v === undefined ? <Skeleton className="h-[30px] w-10" /> : v);

/** The member's start page: what is new, what is due and what their organization is waiting for. */
export function PortalDashboardPage() {
  const me = useMe();
  const showAnnouncements = hasFeature(me, 'announcements');
  const showDocuments = hasFeature(me, 'documents');
  const showTodos = hasFeature(me, 'todos');
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [todoPage, setTodoPage] = useState(1);
  const [announcementSearch, setAnnouncementSearch] = useState({ typed: '', applied: '' });
  const [todoSearch, setTodoSearch] = useState({ typed: '', applied: '' });
  const announcements = useMyAnnouncements({
    page: announcementPage,
    per_page: 5,
    ...(announcementSearch.applied ? { 'filter[title]': announcementSearch.applied } : {}),
  });
  const todos = useMyTodos('open', {
    page: todoPage,
    per_page: 5,
    ...(todoSearch.applied ? { 'filter[description]': todoSearch.applied } : {}),
  });
  const documents = useMyDocuments('approved');
  const requests = useMyDocumentRequests();
  const first = (me.profile?.first_name ?? me.user.display_name ?? me.user.username).split(' ')[0];
  const today = new Date().toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const warned = (documents.data?.counts.expired ?? 0) + (documents.data?.counts.expiring ?? 0);

  return (
    <>
      <PageHero
        eyebrow={me.tenant.name}
        title={`Welcome back, ${first}`}
        description={`${today} · Your crew portal.`}
        mark={Anchor}
        actions={
          showDocuments ? (
            <Link
              to="/portal/files"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FileUp className="size-4" aria-hidden="true" />
              Your files
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showTodos && (
          <StatTile
            to="/portal/todos"
            label="Open to-dos"
            value={figure(todos.data?.open_count)}
            hint={
              todos.data === undefined ? (
                <Skeleton className="mt-1 h-3 w-24" />
              ) : todos.data.overdue_count > 0 ? (
                `${todos.data.overdue_count} overdue`
              ) : (
                'none overdue'
              )
            }
            icon={ICONS.todos}
            tone={todos.data && todos.data.overdue_count > 0 ? 'amber' : 'blue'}
          />
        )}
        {showAnnouncements && (
          <StatTile
            to="/portal/announcements"
            label="Unread announcements"
            value={figure(announcements.data?.unread_count)}
            hint="from your organization"
            icon={ICONS.announcements}
            tone="blue"
          />
        )}
        {showDocuments && (
          <StatTile
            to="/portal/files"
            label="Documents to renew"
            value={figure(documents.data ? warned : undefined)}
            hint={warned > 0 ? 'expired or expiring soon' : 'all in date'}
            icon={ICONS.documents}
            tone={warned > 0 ? 'amber' : 'green'}
          />
        )}
        {showDocuments && (
          <StatTile
            to="/portal/files"
            label="Asked of you"
            value={figure(requests.data?.length)}
            hint="documents to send in"
            icon={ICONS.docTypes}
            tone={requests.data && requests.data.length > 0 ? 'amber' : 'slate'}
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {showAnnouncements && (
          <div className="min-w-0">
            <Panel
              bodyClass={PANEL_BODY}
              title="Latest announcements"
              action={
                <Link to="/portal/announcements" className={headerLink}>
                  See all
                </Link>
              }
            >
              <form
                role="search"
                aria-label="Search announcements"
                className="mb-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAnnouncementSearch((cur) => ({ ...cur, applied: cur.typed.trim() }));
                  setAnnouncementPage(1);
                }}
              >
                <div className="flex-1">
                  <TextField
                    label="Title"
                    value={announcementSearch.typed}
                    onChange={(e) =>
                      setAnnouncementSearch((cur) => ({ ...cur, typed: e.target.value }))
                    }
                    maxLength={100}
                  />
                </div>
                <Button type="submit">Search</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnnouncementSearch({ typed: '', applied: '' });
                    setAnnouncementPage(1);
                  }}
                >
                  Clear
                </Button>
              </form>
              {announcements.isPending ? (
                <SkeletonDataTable
                  compact
                  caption="Latest announcements"
                  headers={['Title', 'Date', '']}
                  cells={['strong', 'date', 'actions1']}
                  rows={5}
                  label="Loading announcements"
                />
              ) : announcements.data && announcements.data.data.length > 0 ? (
                <>
                  <Table compact caption="Latest announcements" headers={['Title', 'Date', '']}>
                    {announcements.data.data.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium">
                          <span className="flex items-center gap-2">
                            {a.is_read === false && (
                              <span
                                aria-label="Unread"
                                className="size-2.5 shrink-0 rounded-full bg-accent-600"
                              />
                            )}
                            {a.title}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{showDay(a.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <IconLink
                            to="/portal/announcements"
                            icon={Eye}
                            label={`Read ${a.title}`}
                            tip="Read"
                          />
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <Pagination
                    meta={announcements.data.meta}
                    loading={announcements.isFetching}
                    onPage={setAnnouncementPage}
                  />
                </>
              ) : (
                <EmptyState
                  title={
                    announcementSearch.applied
                      ? 'No announcement matches'
                      : 'Nothing new from your organization'
                  }
                />
              )}
            </Panel>
          </div>
        )}
        {showTodos && (
          <div className="min-w-0">
            <Panel
              bodyClass={PANEL_BODY}
              title="Next to do"
              action={
                <Link to="/portal/todos" className={headerLink}>
                  See all
                </Link>
              }
            >
              <form
                role="search"
                aria-label="Search to-dos"
                className="mb-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setTodoSearch((cur) => ({ ...cur, applied: cur.typed.trim() }));
                  setTodoPage(1);
                }}
              >
                <div className="flex-1">
                  <TextField
                    label="Task"
                    value={todoSearch.typed}
                    onChange={(e) => setTodoSearch((cur) => ({ ...cur, typed: e.target.value }))}
                    maxLength={100}
                  />
                </div>
                <Button type="submit">Search</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTodoSearch({ typed: '', applied: '' });
                    setTodoPage(1);
                  }}
                >
                  Clear
                </Button>
              </form>
              {todos.isPending ? (
                <SkeletonDataTable
                  compact
                  caption="Next to do"
                  headers={['Task', 'Due date', '']}
                  cells={['strong', 'date', 'actions1']}
                  rows={5}
                  label="Loading to-dos"
                />
              ) : todos.data && todos.data.data.length > 0 ? (
                <>
                  <Table compact caption="Next to do" headers={['Task', 'Due date', '']}>
                    {todos.data.data.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-3 font-medium">{t.description}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {isOverdue(t.due_date, t.is_done) ? (
                            <Badge tone="warning">Overdue</Badge>
                          ) : (
                            showDay(t.due_date)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <IconLink
                            to="/portal/todos"
                            icon={Eye}
                            label={`Open ${t.description}`}
                            tip="Open"
                          />
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <Pagination
                    meta={todos.data.meta}
                    loading={todos.isFetching}
                    onPage={setTodoPage}
                  />
                </>
              ) : (
                <EmptyState
                  title={todoSearch.applied ? 'No task matches' : 'Nothing to do right now'}
                />
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
