import { useState } from 'react';
import {
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
  SelectField,
  Spinner,
  Table,
  TextField,
  useToast,
  SkeletonDataTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Membership, Todo } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { useAssignTodo, useDeleteTodo, useMembers, useTodos, useUpdateTodo } from './api';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const TODO_HEADERS = ['Task', 'Assigned to', 'Due', 'Status', ''];
const TODO_CELLS: CellKind[] = ['strong', 'stack', 'date', 'pill', 'actions2'];

const today = () => new Date().toISOString().slice(0, 10);

function who(
  m: { profile?: Membership['profile']; user?: { username?: string; email?: string } } | undefined,
) {
  const name = m?.profile
    ? [m.profile.first_name, m.profile.last_name].filter(Boolean).join(' ')
    : '';
  return name || m?.user?.username || '—';
}

function stateOf(t: Todo): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (t.is_done) return { label: 'Done', tone: 'success' };
  if (t.due_date && t.due_date < today()) return { label: 'Overdue', tone: 'warning' };
  return { label: 'Open', tone: 'neutral' };
}

export function TodosPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const list = useTodos({ page, per_page: 20, ...(status ? { status } : {}) });
  const remove = useDeleteTodo();
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);

  return (
    <>
      <PageHeader
        title="To-dos"
        description="Tasks you assign to members of your organization. They tick them off in the mobile app."
        actions={<Button onClick={() => setEditing('new')}>New to-do</Button>}
      />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Show"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ]}
        />
      </div>
      {list.isPending ? (
        <SkeletonDataTable
          caption="To-dos"
          headers={TODO_HEADERS}
          cells={TODO_CELLS}
          rows={6}
          label="Loading to-dos"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No to-dos" />
      ) : (
        <>
          <Table caption="To-dos" headers={TODO_HEADERS}>
            {list.data.data.map((t) => {
              const s = stateOf(t);
              return (
                <tr key={t.id}>
                  {/* member-written and admin-written text: rendered as text, never as HTML */}
                  <td className="whitespace-pre-wrap px-4 py-3 font-medium">{t.description}</td>
                  <td className="px-4 py-3">
                    <p>{t.assignee?.user?.username}</p>
                    <p className="text-xs text-muted">{t.assignee?.user?.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{t.due_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {t.done_at ? (
                      <p className="mt-1 text-xs text-muted">{formatDateTime(t.done_at)}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.description}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="dangerSoft"
                        onClick={() => setDeleting(t)}
                        aria-label={`Delete ${t.description}`}
                      >
                        Delete
                      </Button>
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
        <TodoForm
          key={editing === 'new' ? 'new' : editing.id}
          todo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this to-do?"
        description="It disappears from the member's list in the app. This cannot be undone."
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

function TodoForm({ todo, onClose }: { todo: Todo | null; onClose: () => void }) {
  const assign = useAssignTodo();
  const update = useUpdateTodo();
  const toast = useToast();
  const members = useMembers({ 'filter[status]': 'active', per_page: 100 });
  const [description, setDescription] = useState(todo?.description ?? '');
  const [due, setDue] = useState(todo?.due_date ?? '');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const people = members.data?.data ?? [];

  function toggle(id: string) {
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = description.trim();
    if (!text) return setError('Write the task.');
    if (!todo && chosen.size === 0) return setError('Choose at least one member.');
    setBusy(true);
    try {
      if (todo) {
        await update.mutateAsync({
          id: todo.id,
          patch: { description: text, due_date: due || null },
        });
        toast.success('To-do saved.');
      } else {
        const created = await assign.mutateAsync({
          description: text,
          due_date: due || null,
          membership_ids: [...chosen],
        });
        toast.success(
          created.length === 1 ? 'To-do assigned.' : `To-do assigned to ${created.length} members.`,
        );
      }
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      title={todo ? 'Edit to-do' : 'New to-do'}
      description={todo ? undefined : 'One task is created for each member you choose.'}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label="Task"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <DateField label="Due date (optional)" value={due} onChange={setDue} />
        {todo ? (
          <Card className="text-sm text-muted">
            Assigned to {who(todo.assignee as never)}. To give it to someone else, delete it and
            create a new one.
          </Card>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Assign to</legend>
            {members.isPending ? (
              <Spinner />
            ) : members.isError ? (
              <p role="alert" className="text-xs text-bad-fg">
                {describeError(members.error)}
              </p>
            ) : people.length === 0 ? (
              <p className="text-sm text-muted">No active members yet.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={chosen.size === people.length}
                    onChange={() =>
                      setChosen(
                        chosen.size === people.length
                          ? new Set()
                          : new Set(people.map((p) => p.id)),
                      )
                    }
                  />
                  Everyone ({people.length})
                </label>
                <div className="max-h-48 overflow-auto rounded-md border border-line p-2">
                  {people.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={chosen.has(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                      <span>{who(p)}</span>
                      <span className="text-xs text-muted">{p.user?.email}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {todo ? 'Save' : 'Assign'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
