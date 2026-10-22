import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Anchor, Cake, Hash, Mail, Phone, Ship, User } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
  ProfileTabs,
  SaveBar,
  StatusBadge,
  Table,
  TextField,
  useToast,
  Skeleton,
  SkeletonDataTable,
  SkeletonTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Crew, Todo } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import { Avatar, BACK_PILL, Fact } from '../shared/Hero';
import { CrewDocumentsSection } from './CrewDocumentsSection';
import {
  useAssignTodo,
  useCrewMember,
  useDeleteTodo,
  useSendCrewPasswordReset,
  useUpdateMember,
  useTodos,
  useUpdateCrew,
  useUpdateTodo,
} from './api';

const TASK_HEADERS = ['Task', 'Due date', 'Status', ''];
const TASK_CELLS: CellKind[] = ['strong', 'date', 'pill', 'actions2'];

/** The sections of the crew page, in order. Shared with the page's loading placeholder. */
const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'todos', label: 'To-do list' },
] as const;

/** A form field as pure shimmer: the label bar and the box. */
function ShimmerField() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="min-h-10 w-full rounded-xl" />
    </div>
  );
}

/** A card as pure shimmer: its title bar and a grid of fields. */
function ShimmerCard({ fields, wide }: { fields: number; wide?: boolean }) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-pad)] shadow-[var(--shadow-soft)] ${wide ? 'lg:col-span-2' : ''}`}
    >
      <Skeleton className="mb-4 h-5 w-28" />
      <div className={`grid gap-4 sm:grid-cols-2 ${wide ? 'lg:grid-cols-3' : ''}`}>
        {Array.from({ length: fields }, (_, i) => (
          <ShimmerField key={i} />
        ))}
      </div>
    </section>
  );
}

/**
 * The whole crew page while the member loads, as shimmer from top to bottom: the back link, the hero, the tabs and the
 * open section (cards and fields, or a table). The same frames and spacing as the page, so nothing moves when it arrives.
 */
function CrewProfileSkeleton({ tab }: { tab: string }) {
  return (
    <div role="status" aria-label="Loading crew member" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40 rounded-full" />
      <header className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {['w-28', 'w-40', 'w-20', 'w-36', 'w-24'].map((w) => (
                <Skeleton key={w} className={`h-4 ${w}`} />
              ))}
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </header>
      <div className="flex gap-1 border-b border-line">
        {['w-20', 'w-24', 'w-28'].map((w) => (
          <div key={w} className="px-4 py-2.5">
            <Skeleton className={`h-4 ${w}`} />
          </div>
        ))}
      </div>
      {tab === 'documents' || tab === 'todos' ? (
        <SkeletonTable rows={tab === 'documents' ? 5 : 3} columns={4} label="Loading" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ShimmerCard fields={6} wide />
          <ShimmerCard fields={5} />
          <ShimmerCard fields={2} />
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

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

/** One crew member: a hero with who they are, then Details (the record), Documents and the to-do list as tabs. */
export function CrewProfilePage() {
  const { id = '' } = useParams();
  const crew = useCrewMember(id);
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? 'details';
  const tab = TABS.some((x) => x.key === requested) ? requested : 'details';

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {crew.isPending ? (
        <CrewProfileSkeleton tab={tab} />
      ) : crew.isError ? (
        <>
          <Link to="/app/crew" className={BACK_PILL}>
            ← Back to crew
          </Link>
          <ErrorState message={describeError(crew.error)} onRetry={() => void crew.refetch()} />
        </>
      ) : (
        <Profile
          crew={crew.data}
          tab={tab}
          onTab={(key) => setParams(key === 'details' ? {} : { tab: key }, { replace: true })}
        />
      )}
    </div>
  );
}

function Profile({ crew, tab, onTab }: { crew: Crew; tab: string; onTab: (key: string) => void }) {
  const update = useUpdateCrew(crew.id);
  const reset = useSendCrewPasswordReset(crew.id);
  const decide = useUpdateMember();
  const [confirmReject, setConfirmReject] = useState(false);
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
  const post = [crew.rank, crew.fleet, crew.vessel].filter(Boolean).join(' · ');

  return (
    <>
      <Link to="/app/crew" className={BACK_PILL}>
        ← Back to crew
      </Link>
      <header className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-3xl font-bold leading-tight">{name}</h1>
              <StatusBadge status={crew.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Fact icon={<User className="size-4" />}>{crew.username}</Fact>
              <Fact icon={<Mail className="size-4" />}>{crew.email}</Fact>
              {crew.crew_number && (
                <Fact icon={<Hash className="size-4" />} mono>
                  {crew.crew_number}
                </Fact>
              )}
              {post && <Fact icon={<Ship className="size-4" />}>{post}</Fact>}
              {crew.mobile && <Fact icon={<Phone className="size-4" />}>{crew.mobile}</Fact>}
              {crew.birthday && <Fact icon={<Cake className="size-4" />}>{crew.birthday}</Fact>}
              {crew.date_arrive && (
                <Fact icon={<Anchor className="size-4" />}>
                  On board {crew.date_arrive}
                  {crew.date_depart ? ` to ${crew.date_depart}` : ''}
                </Fact>
              )}
            </div>
          </div>
          {crew.status === 'pending' ? (
            <div className="flex gap-2">
              <Button
                loading={decide.isPending}
                onClick={() => decide.mutate({ id: crew.id, patch: { status: 'active' } })}
              >
                Approve
              </Button>
              <Button variant="danger" onClick={() => setConfirmReject(true)}>
                Reject
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              disabled={crew.status !== 'active'}
              onClick={() => setConfirmReset(true)}
            >
              Reset password
            </Button>
          )}
        </div>
      </header>

      <ProfileTabs label="Crew sections" tabs={[...TABS]} value={tab} onChange={onTab} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'details' && (
          <form
            id="crew-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-6"
          >
            <FormError message={formError} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Personal" className="lg:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <TextField label="Last name" {...field('last_name')} />
                  <TextField label="First name" {...field('first_name')} />
                  <TextField label="Middle name" {...field('middle_name')} />
                  <TextField label="Suffix" {...field('suffix')} />
                  <TextField label="Birthday" type="date" {...field('birthday')} />
                  <TextField label="Mobile" type="tel" {...field('mobile')} />
                </div>
              </Card>
              <Card title="Employment">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Crew ID" {...field('crew_number')} />
                  <TextField label="Rank" {...field('rank')} />
                  <TextField label="Fleet" {...field('fleet')} />
                  <TextField label="Vessel" {...field('vessel')} />
                  <div className="sm:col-span-2">
                    <TextField label="Employment status" {...field('employment_status')} />
                  </div>
                </div>
              </Card>
              <Card title="Dates on board">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Date arrive" type="date" {...field('date_arrive')} />
                  <TextField label="Date depart" type="date" {...field('date_depart')} />
                </div>
              </Card>
            </div>
            <SaveBar
              dirty={isDirty}
              saving={isSubmitting}
              formId="crew-form"
              onDiscard={() => {
                resetForm(toForm(crew));
                setFormError(null);
              }}
            />
          </form>
        )}
        {tab === 'documents' && <CrewDocumentsSection crew={crew} />}
        {tab === 'todos' && <CrewTodos crew={crew} />}
      </div>

      <ConfirmDialog
        open={confirmReject}
        title={`Reject ${name}?`}
        description="They will not be able to sign in. You can reactivate them later."
        confirmLabel="Reject"
        destructive
        loading={decide.isPending}
        onConfirm={() =>
          decide.mutate(
            { id: crew.id, patch: { status: 'suspended' } },
            { onSettled: () => setConfirmReject(false) },
          )
        }
        onCancel={() => setConfirmReject(false)}
      />

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
        <SkeletonDataTable
          caption="Tasks"
          headers={TASK_HEADERS}
          cells={TASK_CELLS}
          rows={3}
          label="Loading tasks"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No tasks" description="Tasks you add show up in this member's app." />
      ) : (
        <Table caption="Tasks" headers={TASK_HEADERS}>
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
                    variant="dangerSoft"
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
