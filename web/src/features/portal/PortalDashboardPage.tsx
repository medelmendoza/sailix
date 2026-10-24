import { Anchor, FileUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, PageHero, Skeleton, StatTile } from '../../components/ui';
import { ICONS } from '../../components/icons';
import { hasFeature, useMe } from '../authentication/session';
import { useMyAnnouncements, useMyDocumentRequests, useMyDocuments, useMyTodos } from './api';
import { isOverdue, showDay } from './format';

const figure = (v?: number) => (v === undefined ? <Skeleton className="h-[30px] w-10" /> : v);

/** The member's start page: what is new, what is due and what their organization is waiting for. */
export function PortalDashboardPage() {
  const me = useMe();
  const showAnnouncements = hasFeature(me, 'announcements');
  const showDocuments = hasFeature(me, 'documents');
  const showTodos = hasFeature(me, 'todos');
  const announcements = useMyAnnouncements({ per_page: 3 });
  const todos = useMyTodos('open', { per_page: 3 });
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
          <Card
            title="Latest announcements"
            actions={
              <Link to="/portal/announcements" className="text-sm text-accent-600 hover:underline">
                See all
              </Link>
            }
          >
            {announcements.isPending ? (
              <div role="status" aria-label="Loading announcements" className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : announcements.data && announcements.data.data.length > 0 ? (
              <ul className="divide-y divide-line">
                {announcements.data.data.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    {a.is_read === false && (
                      <span
                        aria-label="Unread"
                        className="size-2.5 shrink-0 rounded-full bg-accent-600"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">{showDay(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing new from your organization.</p>
            )}
          </Card>
        )}
        {showTodos && (
          <Card
            title="Next to do"
            actions={
              <Link to="/portal/todos" className="text-sm text-accent-600 hover:underline">
                See all
              </Link>
            }
          >
            {todos.isPending ? (
              <div role="status" aria-label="Loading to-dos" className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : todos.data && todos.data.data.length > 0 ? (
              <ul className="divide-y divide-line">
                {todos.data.data.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {t.description}
                    </span>
                    {isOverdue(t.due_date, t.is_done) ? (
                      <Badge tone="warning">Overdue</Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">
                        {t.due_date ? `Due ${showDay(t.due_date)}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing to do right now.</p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
