import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  StatusBadge,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { applyServerErrors } from '../authentication/forms';
import type { Tenant } from '../../services/api/types';
import { describeError, useInviteAdmin, useTenantAdmins } from './api';
import { AdminsTableSkeleton, ADMIN_HEADERS } from './TenantDetailSkeleton';

const inviteSchema = z.object({
  email: z.email('Enter a valid email address.'),
  username: z.string().regex(/^([A-Za-z0-9._-]{1,64})?$/, 'Letters, digits . _ - only.'),
  display_name: z.string().max(120),
});
type InviteValues = z.infer<typeof inviteSchema>;

export function InviteDialog({
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

/** The administrators of the organization, and the way to invite another. */
export function TenantAdminsTab({ tenant }: { tenant: Tenant }) {
  const admins = useTenantAdmins(tenant.id);
  const [inviting, setInviting] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  return (
    <>
      <Card
        title="Administrators"
        actions={
          tenant.status === 'deactivated' || tenant.status === 'archived' ? undefined : (
            <Button onClick={() => setInviting(true)}>Invite administrator</Button>
          )
        }
      >
        {devToken && (
          <p role="status" className="mb-3 rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-fg">
            Development only: this server returned the invitation token instead of relying on email:{' '}
            <code className="break-all">{devToken}</code>
          </p>
        )}
        {admins.isPending ? (
          <AdminsTableSkeleton />
        ) : admins.isError ? (
          <ErrorState message={describeError(admins.error)} onRetry={() => void admins.refetch()} />
        ) : admins.data.data.length === 0 ? (
          <EmptyState
            title="No administrators yet"
            description="Invite one, then activate the organization once they have accepted."
          />
        ) : (
          <Table caption="Administrators" headers={ADMIN_HEADERS}>
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
      <InviteDialog
        tenantId={tenant.id}
        open={inviting}
        onClose={() => setInviting(false)}
        onToken={setDevToken}
      />
    </>
  );
}
