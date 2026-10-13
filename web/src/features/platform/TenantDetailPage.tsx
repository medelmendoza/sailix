import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { toApiError } from '../../services/api/errors';
import type { PlatformTenantModule, Tenant, TenantStatus } from '../../services/api/types';
import { applyServerErrors } from '../authentication/forms';
import {
  describeError,
  useInviteAdmin,
  usePlatformModules,
  useProvisionModule,
  useTenantAdmins,
  useTenantById,
  useTransition,
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

/** Modules built into the app: nothing to map to an external team, an organization simply has them or not. */
const BUILT_IN_MODULES = ['astra', 'callit'];
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

  const builtIn = BUILT_IN_MODULES.includes(module.code);

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

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const tenant = useTenantById(id);
  const admins = useTenantAdmins(id);
  const modules = usePlatformModules(id);
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
      <PageHeader
        title={t.name}
        description={`Code ${t.code}`}
        actions={
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
        }
      />

      <div className="flex flex-col gap-6">
        <Card
          title="Administrators"
          actions={
            t.status === 'deactivated' || t.status === 'archived' ? undefined : (
              <Button onClick={() => setInviting(true)}>Invite administrator</Button>
            )
          }
        >
          {devToken && (
            <p role="status" className="mb-3 rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-fg">
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
