import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import {
  Button,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  Pagination,
  SelectField,
  Spinner,
  StatusBadge,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { applyServerErrors } from '../authentication/forms';
import { formatDateTime } from '../shared/AuditTable';
import { describeError, useCreateTenant, useTenants } from './api';

const STATUS_OPTIONS = ['', 'provisioning', 'active', 'suspended', 'deactivated', 'archived'].map(
  (v) => ({ value: v, label: v ? v[0]!.toUpperCase() + v.slice(1) : 'All statuses' }),
);

const createSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{2,32}$/, 'Use 2–32 letters or digits.'),
  name: z.string().min(1, 'Enter the organization name.').max(255),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTenant();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  function submit(values: CreateValues) {
    setFormError(null);
    create.mutate(values, {
      onSuccess: (tenant) => {
        toast.success(`Organization ${tenant.code} created.`);
        reset();
        onClose();
        void navigate(`/platform/tenants/${tenant.id}`);
      },
      onError: (e) => setFormError(applyServerErrors(e, setError, ['code', 'name'])),
    });
  }

  return (
    <FormDialog
      open={open}
      title="New organization"
      description="It starts in provisioning. Invite its first administrator, then activate it."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Agency code"
          hint="Short, unique, used by members to register (e.g. SFAI)."
          autoCapitalize="characters"
          error={errors.code?.message}
          {...register('code')}
        />
        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create organization
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

export function TenantsPage() {
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const tenants = useTenants({
    page,
    per_page: 20,
    'filter[status]': status || undefined,
    'filter[q]': q || undefined,
  });

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Every organization on the platform."
        actions={<Button onClick={() => setCreating(true)}>New organization</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => set({ status: e.target.value, page: '' })}
        />
        <TextField
          label="Search by code or name"
          defaultValue={q}
          onChange={(e) => set({ q: e.target.value, page: '' })}
        />
      </div>
      {tenants.isPending ? (
        <Spinner />
      ) : tenants.isError ? (
        <ErrorState message={describeError(tenants.error)} onRetry={() => void tenants.refetch()} />
      ) : tenants.data.data.length === 0 ? (
        <EmptyState title="No organizations match" />
      ) : (
        <>
          <Table caption="Organizations" headers={['Code', 'Name', 'Status', 'Created']}>
            {tenants.data.data.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/platform/tenants/${t.id}`}
                    className="text-accent-600 hover:underline"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(t.created_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination meta={tenants.data.meta} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
