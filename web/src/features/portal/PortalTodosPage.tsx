import { useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  StatusTabs,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { useMyTodos, useToggleMyTodo, type TodoView } from './api';
import { isOverdue, showDay } from './format';

/** The tasks the organization gave this member: tick one to say it is done, untick to open it again. */
export function PortalTodosPage() {
  const [view, setView] = useState<TodoView>('open');
  const [page, setPage] = useState(1);
  const list = useMyTodos(view, { page, per_page: 15 });
  const toggle = useToggleMyTodo();
  const toast = useToast();

  return (
    <>
      <PageHeader title="To-do list" description="Tasks your organization gave you." />
      <div className="mb-4">
        <StatusTabs
          label="To-dos"
          value={view}
          onChange={(k) => {
            setView(k as TodoView);
            setPage(1);
          }}
          tabs={[
            {
              key: 'open',
              label: 'Open',
              count: list.data && view === 'open' ? list.data.open_count : undefined,
            },
            { key: 'done', label: 'Done' },
            { key: 'all', label: 'All' },
          ]}
        />
      </div>

      {list.isPending ? (
        <div role="status" aria-label="Loading to-dos" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]"
            >
              <Skeleton className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={view === 'done' ? 'Nothing done yet' : 'Nothing to do'}
          description={view === 'open' ? 'Tasks from your organization show up here.' : undefined}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {list.data.data.map((t) => {
              const late = isOverdue(t.due_date, t.is_done);
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand-700)]"
                    aria-label={`${t.is_done ? 'Reopen' : 'Mark as done'}: ${t.description}`}
                    checked={t.is_done}
                    disabled={toggle.isPending && toggle.variables?.id === t.id}
                    onChange={(e) =>
                      toggle.mutate(
                        { id: t.id, done: e.target.checked },
                        { onError: (err) => toast.error(describeError(err)) },
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    {/* the task is plain text, shown as text */}
                    <p
                      className={`whitespace-pre-wrap text-sm font-medium ${t.is_done ? 'text-muted line-through' : ''}`}
                    >
                      {t.description}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {t.due_date ? `Due ${showDay(t.due_date)}` : 'No due date'}
                      {late && <Badge tone="warning">Overdue</Badge>}
                      {t.is_done && t.done_at && <span>Done {showDay(t.done_at)}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination meta={list.data.meta} loading={list.isFetching} onPage={setPage} />
        </>
      )}
    </>
  );
}
