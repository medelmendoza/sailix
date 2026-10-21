import type { Tenant, TenantStatus } from '../../services/api/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FormDialog, FormError, TextField, useToast } from '../../components/ui';
import { applyServerErrors } from '../authentication/forms';
import { useTransition } from './api';

export interface LifecycleAction {
  action: string;
  label: string;
  reasonRequired: boolean;
  destructive?: boolean;
  help: string;
}

export const ACTIONS: Record<TenantStatus, LifecycleAction[]> = {
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

export function LifecycleDialog({
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
