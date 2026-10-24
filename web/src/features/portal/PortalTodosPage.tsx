import { Check, Undo2 } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  SelectField,
  SkeletonDataTable,
  Table,
  useToast,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { useMyTodos, useToggleMyTodo, type TodoView } from './api';
import { isOverdue, showDay } from './format';

const HEADERS = ['Task', 'Due date', 'Status', ''];
const CELLS: CellKind[] = ['strong', 'date', 'pill', 'actions1'];

/** The tasks the organization gave this member, in the admin portal's kind of table: mark one done, or reopen it. */
export function PortalTodosPage() {
  const [view, setView] = useState<TodoView>('open');
  const [page, setPage] = useState(1);
  const list = useMyTodos(view, { page, per_page: 15 });
  const toggle = useToggleMyTodo();
  const toast = useToast();

  return (
    <>
      <PageHeader title="To-do list" description="Tasks your organization gave you." />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Show"
          value={view}
          onChange={(e) => {
            setView(e.target.value as TodoView);
            setPage(1);
          }}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {list.isPending ? (
        <SkeletonDataTable
          caption="To-dos"
          headers={HEADERS}
          cells={CELLS}
          rows={5}
          label="Loading to-dos"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title={view === 'done' ? 'Nothing done yet' : 'Nothing to do'}
          description={view === 'open' ? 'Tasks from your organization show up here.' : undefined}
        />
      ) : (
        <>
          <Table caption="To-dos" headers={HEADERS}>
            {list.data.data.map((t) => {
              const late = isOverdue(t.due_date, t.is_done);
              return (
                <tr key={t.id}>
                  {/* the task is plain text, shown as text */}
                  <td className="whitespace-pre-wrap px-4 py-3 font-medium">{t.description}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.due_date ? showDay(t.due_date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={t.is_done ? 'success' : late ? 'warning' : 'neutral'}>
                      {t.is_done ? 'Done' : late ? 'Overdue' : 'Open'}
                    </Badge>
                    {t.is_done && t.done_at ? (
                      <p className="mt-1 text-xs text-muted">{showDay(t.done_at)}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <IconButton
                      icon={t.is_done ? Undo2 : Check}
                      tone={t.is_done ? 'neutral' : 'primary'}
                      label={`${t.is_done ? 'Reopen' : 'Mark as done'}: ${t.description}`}
                      tip={t.is_done ? 'Reopen' : 'Mark as done'}
                      disabled={toggle.isPending && toggle.variables?.id === t.id}
                      onClick={() =>
                        toggle.mutate(
                          { id: t.id, done: !t.is_done },
                          { onError: (err) => toast.error(describeError(err)) },
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination meta={list.data.meta} loading={list.isFetching} onPage={setPage} />
        </>
      )}
    </>
  );
}
