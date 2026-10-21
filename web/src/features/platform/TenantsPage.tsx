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
  SearchField,
  SkeletonTable,
  StatusBadge,
  StatusTabs,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { applyServerErrors } from '../authentication/forms';
import { formatDateTime } from '../shared/AuditTable';
import {
  describeError,
  TENANT_STATUSES,
  useCreateTenant,
  useTenantCounts,
  useTenants,
} from './api';
import { TenantSummary } from './TenantSummary';

const createSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{2,32}$/, 'Use 2–32 letters or digits.'),
  name: z.string().min(1, 'Enter the organization name.').max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => v === '' || /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/.test(v),
      'Lowercase letters, digits and single hyphens (3–40), starting and ending with a letter or digit.',
    )
    .refine((v) => v === '' || (v.length >= 3 && v.length <= 40), 'Use 3 to 40 characters.'),
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
    create.mutate(
      { code: values.code, name: values.name, ...(values.slug ? { slug: values.slug } : {}) },
      {
        onSuccess: (tenant) => {
          toast.success(`Organization ${tenant.code} created.`);
          reset();
          onClose();
          void navigate(`/platform/tenants/${tenant.id}`);
        },
        onError: (e) => setFormError(applyServerErrors(e, setError, ['code', 'name', 'slug'])),
      },
    );
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
        <TextField
          label="Address name (optional)"
          hint="Its default address is <name>.<Sailix domain>. Empty: the agency code in lowercase. It cannot be changed later."
          error={errors.slug?.message}
          {...register('slug')}
        />
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

const cap = (v: string) => v[0]!.toUpperCase() + v.slice(1);

function StatusFilter({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const c = useTenantCounts();
  const tabs = [
    { key: '', label: 'All', count: c.all ?? null },
    ...TENANT_STATUSES.map((s) => ({ key: s, label: cap(s), count: c[s] ?? null })),
  ];
  return <StatusTabs label="Filter by status" tabs={tabs} value={value} onChange={onChange} />;
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
  const anyFilter = Boolean(status || q);

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Every organization on the platform."
        actions={<Button onClick={() => setCreating(true)}>New organization</Button>}
      />
      <TenantSummary />
      <StatusFilter value={status} onChange={(s) => set({ status: s, page: '' })} />
      <div className="my-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <SearchField
            label="Search organizations"
            placeholder="Search by code or name"
            value={q}
            onSearch={(v) => set({ q: v, page: '' })}
          />
        </div>
        {anyFilter && (
          <button
            type="button"
            className="text-sm text-accent-600 hover:underline"
            onClick={() => set({ status: '', q: '', page: '' })}
          >
            Clear filters
          </button>
        )}
      </div>
      {tenants.isPending ? (
        <SkeletonTable columns={5} rows={6} label="Loading organizations" />
      ) : tenants.isError ? (
        <ErrorState message={describeError(tenants.error)} onRetry={() => void tenants.refetch()} />
      ) : tenants.data.data.length === 0 ? (
        <EmptyState
          title={anyFilter ? 'No organizations match your filters' : 'No organizations yet'}
        />
      ) : (
        <>
          <Table
            caption="Organizations"
            headers={['Organization', 'Address', 'Status', 'Created', '']}
          >
            {tenants.data.data.map((t) => (
              <tr key={t.id} className="hover:bg-page">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-600 to-brand-800 text-sm font-semibold text-white"
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/platform/tenants/${t.id}`}
                        className="block truncate font-medium text-accent-600 hover:underline"
                      >
                        {t.name}
                      </Link>
                      <span className="font-mono text-xs text-muted">{t.code}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {t.default_address ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(t.created_at)}</td>
                <td className="w-10 px-2 py-3 text-right">
                  <Link
                    to={`/platform/tenants/${t.id}`}
                    aria-label={`Open ${t.name}`}
                    className="rounded-full px-2 py-1 text-muted hover:bg-line/50 hover:text-brand-800"
                  >
                    ›
                  </Link>
                </td>
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
