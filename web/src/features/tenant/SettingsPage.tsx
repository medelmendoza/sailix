import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Card,
  ErrorState,
  FormError,
  PageHeader,
  TextField,
  useToast,
  Skeleton,
  SkeletonField,
} from '../../components/ui';
import { api } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import { applyServerErrors } from '../authentication/forms';
import { TENANT_SESSION } from '../authentication/session';
import { useTenantDetail } from './api';

const schema = z.object({
  display_name: z.string().max(120, 'At most 120 characters.'),
  privacy_policy_url: z
    .string()
    .max(255)
    .refine((v) => v === '' || /^https:\/\//.test(v), 'Use a secure https:// address.'),
  password_min_length: z.coerce
    .number()
    .int('Whole number.')
    .min(8, 'At least 8.')
    .max(128, 'At most 128.'),
});
type Input = z.input<typeof schema>;
type Values = z.output<typeof schema>;

// The form's hints, shared with its loading placeholder so both read the same
const DISPLAY_NAME_HINT = 'Shown to your members instead of the registered name.';
const PRIVACY_HINT = 'Optional. Must start with https://';
const PASSWORD_HINT = 'You can raise this above the platform minimum, never lower it.';

/** The form while the settings load: its real card, labels and hints, with the controls shimmering. */
function SettingsSkeleton() {
  return (
    <Card>
      <div role="status" aria-label="Loading settings" className="flex max-w-lg flex-col gap-4">
        <SkeletonField label="Display name" hint={DISPLAY_NAME_HINT} />
        <SkeletonField label="Privacy policy address" hint={PRIVACY_HINT} />
        <SkeletonField label="Minimum password length" hint={PASSWORD_HINT} />
        <Skeleton className="h-10 w-36 rounded-full" />
        <span className="sr-only">Loading…</span>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const tenant = useTenantDetail();
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Input, unknown, Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (tenant.data) {
      const s = tenant.data.settings as Record<string, unknown>;
      reset({
        display_name: String(s.display_name ?? ''),
        privacy_policy_url: String(s.privacy_policy_url ?? ''),
        password_min_length: Number(s.password_min_length ?? 8),
      });
    }
  }, [tenant.data, reset]);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.patch('/tenant', {
        settings: {
          display_name: values.display_name || null,
          privacy_policy_url: values.privacy_policy_url || null,
          password_min_length: values.password_min_length,
        },
      });
      toast.success('Settings saved.');
      void qc.invalidateQueries({ queryKey: ['tenant'] });
      void qc.invalidateQueries({ queryKey: TENANT_SESSION });
    } catch (e) {
      setFormError(
        applyServerErrors(e, setError, [
          'display_name',
          'privacy_policy_url',
          'password_min_length',
        ]),
      );
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Organization profile and security." />
      {tenant.isPending ? (
        <SettingsSkeleton />
      ) : tenant.isError ? (
        <ErrorState message={describeError(tenant.error)} onRetry={() => void tenant.refetch()} />
      ) : (
        <Card>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex max-w-lg flex-col gap-4"
          >
            <FormError message={formError} />
            <TextField
              label="Display name"
              hint={DISPLAY_NAME_HINT}
              error={errors.display_name?.message}
              {...register('display_name')}
            />
            <TextField
              label="Privacy policy address"
              type="url"
              hint={PRIVACY_HINT}
              error={errors.privacy_policy_url?.message}
              {...register('privacy_policy_url')}
            />
            <TextField
              label="Minimum password length"
              type="number"
              hint={PASSWORD_HINT}
              error={errors.password_min_length?.message}
              {...register('password_min_length')}
            />
            <div>
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
