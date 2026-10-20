import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Crew, Todo } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import { CrewDocumentsSection } from './CrewDocumentsSection';
import {
  useAssignTodo,
  useCrewMember,
  useDeleteTodo,
  useSendCrewPasswordReset,
  useTodos,
  useUpdateCrew,
  useUpdateTodo,
} from './api';

const text = (max: number) => z.string().max(max, `At most ${max} characters.`);
const day = z
  .string()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use a valid date.');

const schema = z
  .object({
    first_name: text(100).trim().min(1, 'Required.'),
    middle_name: text(100),
    last_name: text(100).trim().min(1, 'Required.'),
    suffix: text(20),
    mobile: text(20),
    crew_number: text(30).refine(
      (v) => v === '' || /^[A-Za-z0-9._/-]+$/.test(v),
      'Letters, digits and . _ / - only.',
    ),
    rank: text(60),
    fleet: text(100),
    vessel: text(100),
    employment_status: text(60),
    date_arrive: day,
    date_depart: day,
    birthday: day,
  })
  .refine((v) => !v.date_arrive || !v.date_depart || v.date_depart >= v.date_arrive, {
    path: ['date_depart'],
    message: 'Departure cannot be before arrival.',
  });
type Values = z.infer<typeof schema>;
const FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'suffix',
  'mobile',
  'crew_number',
  'rank',
  'fleet',
  'vessel',
  'employment_status',
  'date_arrive',
  'date_depart',
  'birthday',
] as const;

const toForm = (c: Crew): Values =>
  Object.fromEntries(FIELDS.map((f) => [f, (c[f] as string | null | undefined) ?? ''])) as Values;

const today = () => new Date().toISOString().slice(0, 10);

function todoState(t: Todo): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (t.is_done) return { label: 'Completed', tone: 'success' };
  if (t.due_date && t.due_date < today()) return { label: 'Overdue', tone: 'warning' };
  return { label: 'Ongoing', tone: 'neutral' };
}

/** One crew member: their record (editable), the password-reset action, and the tasks assigned to them. */
export function CrewProfilePage() {
  const { id = '' } = useParams();
  const crew = useCrewMember(id);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/app/crew" className="text-brand underline-offset-2 hover:underline">
          ← Back to crew
        </Link>
      </p>
      {crew.isPending ? (
        <Spinner label="Loading crew member" />
      ) : crew.isError ? (
        <ErrorState message={describeError(crew.error)} onRetry={() => void crew.refetch()} />
      ) : (
        <Profile crew={crew.data} />
      )}
    </>
  );
}

function Profile({ crew }: { crew: Crew }) {
  const update = useUpdateCrew(crew.id);
  const reset = useSendCrewPasswordReset(crew.id);
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const {
    register,
    handleSubmit,
    reset: resetForm,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toForm(crew) });

  useEffect(() => resetForm(toForm(crew)), [crew, resetForm]);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      toast.success('Crew record saved.');
    } catch (e) {
      setFormError(applyServerErrors(e, setError, [...FIELDS]));
    }
  }

  const name = [crew.first_name, crew.last_name].filter(Boolean).join(' ') || crew.username;
  const field = (f: (typeof FIELDS)[number]) => ({ error: errors[f]?.message, ...register(f) });

  return (
    <>
      <PageHeader
        title={name}
        description={`Username ${crew.username} · ${crew.email}`}
        actions={
          <Button
            variant="secondary"
            disabled={crew.status !== 'active'}
            onClick={() => setConfirmReset(true)}
          >
            Reset password
          </Button>
        }
      />
      <p className="-mt-2 mb-4">
        <StatusBadge status={crew.status} />
      </p>

      <Card className="mb-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormError message={formError} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Last name" {...field('last_name')} />
            <TextField label="First name" {...field('first_name')} />
            <TextField label="Middle name" {...field('middle_name')} />
            <TextField label="Suffix" {...field('suffix')} />
            <TextField label="Crew ID" {...field('crew_number')} />
            <TextField label="Rank" {...field('rank')} />
            <TextField label="Fleet" {...field('fleet')} />
            <TextField label="Vessel" {...field('vessel')} />
            <TextField label="Employment status" {...field('employment_status')} />
            <TextField label="Mobile" type="tel" {...field('mobile')} />
            <TextField label="Date arrive" type="date" {...field('date_arrive')} />
            <TextField label="Date depart" type="date" {...field('date_depart')} />
            <TextField label="Birthday" type="date" {...field('birthday')} />
          </div>
          <div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <CrewDocumentsSection crew={crew} />

      <CrewTodos crew={crew} />

      <ConfirmDialog
        open={confirmReset}
        title="Email a password reset link?"
        description={`${name} gets an email with a link to choose a new password. You will not see or set a password.`}
        confirmLabel="Send link"
        loading={reset.isPending}
        onConfirm={() => reset.mutate(undefined, { onSettled: () => setConfirmReset(false) })}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}

function CrewTodos({ crew }: { crew: Crew }) {
  const list = useTodos({ membership_id: crew.id, per_page: 50 });
  const remove = useDeleteTodo();
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);

  return (
    <section aria-labelledby="crew-todos">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="crew-todos" className="text-base font-semibold">
          To-do list
        </h2>
        <Button onClick={() => setEditing('new')} disabled={crew.status !== 'active'}>
          Add task
        </Button>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No tasks" description="Tasks you add show up in this member's app." />
      ) : (
        <Table caption="Tasks" headers={['Task', 'Due date', 'Status', '']}>
          {list.data.data.map((t) => {
            const s = todoState(t);
            return (
              <tr key={t.id}>
                <td className="whitespace-pre-wrap px-4 py-3 font-medium">{t.description}</td>
                <td className="whitespace-nowrap px-4 py-3">{t.due_date ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.tone}>{s.label}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    onClick={() => setEditing(t)}
                    aria-label={`Edit ${t.description}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleting(t)}
                    aria-label={`Delete ${t.description}`}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {editing ? (
        <TaskForm
          key={editing === 'new' ? 'new' : editing.id}
          crew={crew}
          todo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this task?"
        description="It disappears from the member's list in the app. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

function TaskForm({ crew, todo, onClose }: { crew: Crew; todo: Todo | null; onClose: () => void }) {
  const assign = useAssignTodo();
  const update = useUpdateTodo();
  const toast = useToast();
  const [description, setDescription] = useState(todo?.description ?? '');
  const [due, setDue] = useState(todo?.due_date ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const task = description.trim();
    if (!task) return setError('Write the task.');
    setBusy(true);
    try {
      if (todo) {
        await update.mutateAsync({
          id: todo.id,
          patch: { description: task, due_date: due || null },
        });
        toast.success('Task saved.');
      } else {
        await assign.mutateAsync({
          description: task,
          due_date: due || null,
          membership_ids: [crew.id],
        });
        toast.success('Task added.');
      }
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog open title={todo ? 'Edit task' : 'Add task'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label="Task name"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="Due date (optional)"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {todo ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
