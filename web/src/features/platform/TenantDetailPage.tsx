import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  SelectField,
  Spinner,
  StatusBadge,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { toApiError } from '../../services/api/errors';
import { platformScope } from '../tenant/api';
import { BrandingEditor } from '../tenant/BrandingPage';
import { DomainsEditor } from '../tenant/DomainsPage';
import type { PlatformTenantModule, Tenant, TenantStatus } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import { formatDateTime } from '../shared/AuditTable';
import {
  describeError,
  useInviteAdmin,
  usePlatformFeatures,
  usePlatformModules,
  useProvisionModule,
  useTenantAdmins,
  useTenantById,
  useTransition,
  useUpdateFeatures,
} from './api';

interface LifecycleAction {
  action: string;
  label: string;
  reasonRequired: boolean;
  destructive?: boolean;
  help: string;
}

const ACTIONS: Record<TenantStatus, LifecycleAction[]> = {
  provisioning: [
    {
      action: 'activate',
      label: 'Activate',
      reasonRequired: false,
      help: 'Members can sign in. Needs at least one administrator who accepted their invitation.',
    },
  ],
  active: [
    {
      action: 'suspend',
      label: 'Suspend',
      reasonRequired: true,
      destructive: true,
      help: 'Everyone in the organization is blocked immediately and all their sessions end.',
    },
    {
      action: 'deactivate',
      label: 'Deactivate',
      reasonRequired: true,
      destructive: true,
      help: 'Long-term shutdown. Everyone is blocked and sessions end.',
    },
  ],
  suspended: [
    {
      action: 'reactivate',
      label: 'Reactivate',
      reasonRequired: false,
      help: 'Members can sign in again (they must sign in anew).',
    },
    {
      action: 'deactivate',
      label: 'Deactivate',
      reasonRequired: true,
      destructive: true,
      help: 'Long-term shutdown.',
    },
  ],
  deactivated: [
    {
      action: 'reactivate',
      label: 'Reactivate',
      reasonRequired: false,
      help: 'Members can sign in again.',
    },
    {
      action: 'archive',
      label: 'Archive',
      reasonRequired: true,
      destructive: true,
      help: 'Final state. Data is frozen and nothing can reactivate it.',
    },
  ],
  archived: [],
};

function LifecycleDialog({
  tenant,
  action,
  onClose,
}: {
  tenant: Tenant;
  action: LifecycleAction | null;
  onClose: () => void;
}) {
  const transition = useTransition(tenant.id);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({
    reason: action?.reasonRequired
      ? z.string().trim().min(3, 'Give a reason (at least 3 characters).').max(500)
      : z.string().max(500),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError: setField,
    formState,
  } = useForm<{ reason: string }>({ resolver: zodResolver(schema) });

  function submit(values: { reason: string }) {
    if (!action) return;
    setError(null);
    transition.mutate(
      { action: action.action, reason: values.reason },
      {
        onSuccess: () => {
          toast.success(`${tenant.name}: ${action.label.toLowerCase()} done.`);
          reset();
          onClose();
        },
        onError: (e) => setError(applyServerErrors(e, setField, ['reason'])),
      },
    );
  }

  return (
    <FormDialog
      open={action !== null}
      title={`${action?.label ?? ''} ${tenant.name}?`}
      description={action?.help}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label={
            action?.reasonRequired ? 'Reason (recorded in the audit log)' : 'Reason (optional)'
          }
          error={formState.errors.reason?.message}
          {...register('reason')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={action?.destructive ? 'danger' : 'primary'}
            loading={transition.isPending}
          >
            {action?.label}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email address.'),
  username: z.string().regex(/^([A-Za-z0-9._-]{1,64})?$/, 'Letters, digits . _ - only.'),
  display_name: z.string().max(120),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteDialog({
  tenantId,
  open,
  onClose,
  onToken,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  onToken: (t: string) => void;
}) {
  const invite = useInviteAdmin(tenantId);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError: setField,
    formState,
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });

  function submit(v: InviteValues) {
    setError(null);
    invite.mutate(
      {
        email: v.email,
        username: v.username || undefined,
        display_name: v.display_name || undefined,
      },
      {
        onSuccess: (res) => {
          toast.success(`Invitation sent to ${v.email}.`);
          const token = res.meta?.invitation_token;
          if (typeof token === 'string') onToken(token); // only returned by non-production backends
          reset();
          onClose();
        },
        onError: (e) =>
          setError(applyServerErrors(e, setField, ['email', 'username', 'display_name'])),
      },
    );
  }

  return (
    <FormDialog
      open={open}
      title="Invite an administrator"
      description="They receive an email to set a password and activate their account."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Username (optional)"
          hint="Defaults to the part of the email before @."
          autoComplete="off"
          error={formState.errors.username?.message}
          {...register('username')}
        />
        <TextField
          label="Display name (optional)"
          autoComplete="off"
          error={formState.errors.display_name?.message}
          {...register('display_name')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={invite.isPending}>
            Send invitation
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

const TEAM_ID = /^[A-Za-z0-9_-]{1,64}$/;

const moduleSchema = z.object({
  external_team_id: z.string(),
  enabled: z.enum(['true', 'false']),
});
type ModuleValues = z.infer<typeof moduleSchema>;

function ModuleCard({ tenantId, module }: { tenantId: string; module: PlatformTenantModule }) {
  const provision = useProvisionModule(tenantId);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setField,
    formState,
  } = useForm<ModuleValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      external_team_id: module.external_team_id ?? '',
      enabled: module.enabled ? 'true' : 'false',
    },
  });

  const builtIn = module.built_in; // built into the app: nothing to map to an external team

  function submit(v: ModuleValues) {
    setError(null);
    if (!builtIn && !TEAM_ID.test(v.external_team_id)) {
      setField('external_team_id', { message: 'Letters, digits, - and _ only (max 64).' });
      return;
    }
    provision.mutate(
      {
        code: module.code,
        ...(builtIn ? {} : { external_team_id: v.external_team_id }),
        enabled: v.enabled === 'true',
      },
      {
        onSuccess: () => toast.success(`${module.label} saved.`),
        onError: (e) =>
          setError(
            applyServerErrors(e, setField, ['external_team_id']) ??
              toApiError(e).field('external_team_id') ??
              null,
          ),
      },
    );
  }

  return (
    <Card
      title={module.label}
      actions={
        <StatusBadge
          status={!module.entitled ? 'not provisioned' : module.enabled ? 'enabled' : 'disabled'}
        />
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-lg flex-col gap-4">
        <FormError message={error} />
        {builtIn ? (
          <p className="text-sm text-muted">
            Built into the app: there is no external team to map. Switch it on for this organization
            and its members see it under Services.
          </p>
        ) : (
          <TextField
            label="External team ID"
            hint="The team of the external system this organization is bound to. Each team can belong to one organization only."
            error={formState.errors.external_team_id?.message}
            {...register('external_team_id')}
          />
        )}
        <SelectField
          label="Status"
          options={[
            { value: 'false', label: 'Disabled' },
            { value: 'true', label: 'Enabled' },
          ]}
          {...register('enabled')}
        />
        {module.entitled && !builtIn && (
          <p className="text-xs text-muted">{module.links_count} linked account(s).</p>
        )}
        <div>
          <Button type="submit" loading={provision.isPending}>
            {module.entitled ? 'Save' : 'Provision'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const TABS = [
  { key: 'admins', label: 'Administrators' },
  { key: 'address', label: 'Address and domains' },
  { key: 'branding', label: 'Branding' },
  { key: 'features', label: 'Feature access' },
  { key: 'modules', label: 'Modules' },
] as const;

function FeatureAccess({ tenantId }: { tenantId: string }) {
  const features = usePlatformFeatures(tenantId);
  const update = useUpdateFeatures(tenantId);
  const toast = useToast();

  if (features.isPending) return <Spinner />;
  if (features.isError) {
    return (
      <ErrorState message={describeError(features.error)} onRetry={() => void features.refetch()} />
    );
  }
  return (
    <section aria-labelledby="features-h" className="flex flex-col gap-3">
      <div>
        <h2 id="features-h" className="text-base font-semibold">
          Feature access
        </h2>
        <p className="text-sm text-muted">
          A feature that is off is hidden in the portal and the mobile app, and the server refuses
          it. Astra, Call-it and Tala are switched under Modules.
        </p>
      </div>
      <Card>
        <ul className="divide-y divide-line">
          {features.data.map((f) => (
            <li key={f.code} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{f.label}</p>
                <p className="text-sm text-muted">{f.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  role="switch"
                  className="size-5 accent-[var(--color-accent-600)]"
                  aria-label={`${f.label} access`}
                  checked={f.enabled}
                  disabled={update.isPending}
                  onChange={(e) => {
                    const on = e.target.checked; // read now: the box has moved by the time the server answers
                    update.mutate(
                      { [f.code]: on },
                      {
                        onSuccess: () => toast.success(`${f.label} ${on ? 'on' : 'off'}.`),
                        onError: (err) => toast.error(describeError(err)),
                      },
                    );
                  }}
                />
                {f.enabled ? 'On' : 'Off'}
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const tenant = useTenantById(id);
  const admins = useTenantAdmins(id);
  const modules = usePlatformModules(id);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((x) => x.key === params.get('tab')) ? params.get('tab')! : 'admins';
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [inviting, setInviting] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  if (tenant.isPending) return <Spinner />;
  if (tenant.isError) {
    const e = toApiError(tenant.error);
    return (
      <>
        <ErrorState
          message={e.status === 404 ? 'That organization does not exist.' : describeError(e)}
          onRetry={e.status === 404 ? undefined : () => void tenant.refetch()}
        />
        <Link
          to="/platform/tenants"
          className="mt-3 inline-block text-sm text-accent-600 hover:underline"
        >
          Back to organizations
        </Link>
      </>
    );
  }

  const t = tenant.data;
  return (
    <>
      <Link
        to="/platform/tenants"
        className="mb-3 inline-block text-sm text-accent-600 hover:underline"
      >
        ← Organizations
      </Link>
      <header className="mb-4 rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-600 to-brand-800 text-xl font-semibold text-white shadow-sm"
            >
              {t.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{t.name}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {t.default_address ? `Code ${t.code} · ${t.default_address}` : `Code ${t.code}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {ACTIONS[t.status].map((a) => (
              <Button
                key={a.action}
                variant={a.destructive ? 'secondary' : 'primary'}
                onClick={() => setAction(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Created</dt>
            <dd>{formatDateTime(t.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Activated</dt>
            <dd>{t.activated_at ? formatDateTime(t.activated_at) : 'Not yet'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              Administrators
            </dt>
            <dd>{admins.isSuccess ? admins.data.data.length : '…'}</dd>
          </div>
        </dl>
        <div
          role="tablist"
          aria-label="Organization"
          className="-mb-1 mt-4 flex gap-1 overflow-x-auto border-t border-line pt-3 text-sm"
        >
          {TABS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              id={`tab-${x.key}`}
              aria-selected={tab === x.key}
              aria-controls={`panel-${x.key}`}
              onClick={() => setParams({ tab: x.key }, { replace: true })}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${
                tab === x.key
                  ? 'bg-accent-100 text-brand-800'
                  : 'text-muted hover:bg-line/50 hover:text-brand-800'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </header>

      <div
        className="flex flex-col gap-6"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'address' && (
          <section aria-labelledby="addr-h" className="flex flex-col gap-3">
            <h2 id="addr-h" className="text-base font-semibold">
              Address and domains
            </h2>
            <DomainsEditor scope={platformScope(t.id)} />
          </section>
        )}
        {tab === 'branding' && (
          <section aria-labelledby="look-h" className="flex flex-col gap-3">
            <h2 id="look-h" className="text-base font-semibold">
              Branding
            </h2>
            <BrandingEditor scope={platformScope(t.id)} />
          </section>
        )}
        {tab === 'admins' && (
          <Card
            title="Administrators"
            actions={
              t.status === 'deactivated' || t.status === 'archived' ? undefined : (
                <Button onClick={() => setInviting(true)}>Invite administrator</Button>
              )
            }
          >
            {devToken && (
              <p
                role="status"
                className="mb-3 rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-fg"
              >
                Development only: this server returned the invitation token instead of relying on
                email: <code className="break-all">{devToken}</code>
              </p>
            )}
            {admins.isPending ? (
              <Spinner />
            ) : admins.isError ? (
              <ErrorState
                message={describeError(admins.error)}
                onRetry={() => void admins.refetch()}
              />
            ) : admins.data.data.length === 0 ? (
              <EmptyState
                title="No administrators yet"
                description="Invite one, then activate the organization once they have accepted."
              />
            ) : (
              <Table caption="Administrators" headers={['Account', 'Email', 'Status']}>
                {admins.data.data.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium">
                      {m.user?.display_name ?? m.user?.username}
                    </td>
                    <td className="px-4 py-3">{m.user?.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        )}

        {tab === 'features' && <FeatureAccess tenantId={t.id} />}
        {tab === 'modules' && (
          <section aria-labelledby="modules-h">
            <h2 id="modules-h" className="mb-3 text-base font-semibold">
              Modules
            </h2>
            {modules.isPending ? (
              <Spinner />
            ) : modules.isError ? (
              <ErrorState
                message={describeError(modules.error)}
                onRetry={() => void modules.refetch()}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {modules.data.map((m) => (
                  <ModuleCard
                    key={`${m.code}-${m.external_team_id}-${m.enabled}`}
                    tenantId={t.id}
                    module={m}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <LifecycleDialog tenant={t} action={action} onClose={() => setAction(null)} />
      <InviteDialog
        tenantId={t.id}
        open={inviting}
        onClose={() => setInviting(false)}
        onToken={setDevToken}
      />
    </>
  );
}
