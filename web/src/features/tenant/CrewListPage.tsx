import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  TextField,
  SkeletonDataTable,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { useCrewList } from './api';

/** This table's columns, shared with its loading placeholder so the two always have the same shape. */
const CREW_HEADERS = ['Name', 'Suffix', 'Crew ID', 'Rank', 'Fleet', 'Employment status', 'Account'];
const CREW_CELLS: CellKind[] = ['strong', 'text', 'text', 'text', 'text', 'text', 'pill'];

const blank = { last_name: '', first_name: '', crew_number: '' };

/** The organization's crew: search by name or crew number, open a person to see and edit their record. */
export function CrewListPage() {
  const [form, setForm] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const list = useCrewList({
    page,
    per_page: 20,
    ...(applied.last_name ? { 'filter[last_name]': applied.last_name } : {}),
    ...(applied.first_name ? { 'filter[first_name]': applied.first_name } : {}),
    ...(applied.crew_number ? { 'filter[crew_number]': applied.crew_number } : {}),
  });

  function search(e: React.FormEvent) {
    e.preventDefault();
    setApplied({
      last_name: form.last_name.trim(),
      first_name: form.first_name.trim(),
      crew_number: form.crew_number.trim(),
    });
    setPage(1);
  }

  function clear() {
    setForm(blank);
    setApplied(blank);
    setPage(1);
  }

  const set = (key: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Crew"
        description="Everyone in your organization's crew and where they serve."
      />
      <Card className="mb-4">
        <form
          onSubmit={search}
          role="search"
          aria-label="Search crew"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="w-full sm:w-56">
            <TextField
              label="Last name"
              value={form.last_name}
              onChange={set('last_name')}
              maxLength={100}
            />
          </div>
          <div className="w-full sm:w-56">
            <TextField
              label="First name"
              value={form.first_name}
              onChange={set('first_name')}
              maxLength={100}
            />
          </div>
          <div className="w-full sm:w-40">
            <TextField
              label="Crew ID"
              value={form.crew_number}
              onChange={set('crew_number')}
              maxLength={30}
            />
          </div>
          <Button type="submit">Search</Button>
          <Button variant="secondary" onClick={clear}>
            Clear
          </Button>
        </form>
      </Card>

      {list.isPending ? (
        <SkeletonDataTable
          caption="Crew"
          headers={CREW_HEADERS}
          cells={CREW_CELLS}
          rows={6}
          label="Loading crew"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          title="No crew found"
          description={
            applied.last_name || applied.first_name || applied.crew_number
              ? 'Nothing matches your search.'
              : 'Crew appear here once they register and you approve them.'
          }
        />
      ) : (
        <>
          <Table caption="Crew list" headers={CREW_HEADERS}>
            {list.data.data.map((c) => {
              const name = [c.last_name, c.first_name].filter(Boolean).join(', ') || c.username;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/app/crew/${c.id}`}
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      {name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.suffix ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{c.crew_number ?? '—'}</td>
                  <td className="px-4 py-3">{c.rank ?? '—'}</td>
                  <td className="px-4 py-3">{c.fleet ?? '—'}</td>
                  <td className="px-4 py-3">{c.employment_status ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
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
