import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Card,
  ErrorState,
  FormError,
  PageHeader,
  SkeletonForm,
  TextField,
} from '../../components/ui';
import { applyServerErrors } from '../authentication/forms';
import { describeError, usePlatformSettings, useUpdatePlatformSettings } from './api';

const schema = z.object({
  tala_api_base_url: z.string().max(255),
  password_min_length: z.coerce
    .number()
    .int('Whole number.')
    .min(8, 'At least 8.')
    .max(128, 'At most 128.'),
  upload_max_mb: z.coerce
    .number()
    .int('Whole number.')
    .min(1, 'At least 1.')
    .max(50, 'At most 50.'),
});
type Input = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function PlatformSettingsPage() {
  const settings = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Input, unknown, Values>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (settings.data) {
      reset({
        tala_api_base_url: String(settings.data.tala_api_base_url ?? ''),
        password_min_length: Number(settings.data.password_min_length ?? 8),
        upload_max_mb: Number(settings.data.upload_max_mb ?? 10),
      });
    }
  }, [settings.data, reset]);

  function submit(v: Values) {
    setFormError(null);
    update.mutate(
      {
        tala_api_base_url: v.tala_api_base_url || null,
        password_min_length: v.password_min_length,
        upload_max_mb: v.upload_max_mb,
      },
      {
        onError: (e) =>
          setFormError(
            applyServerErrors(e, setError, [
              'tala_api_base_url',
              'password_min_length',
              'upload_max_mb',
            ]),
          ),
      },
    );
  }

  return (
    <>
      <PageHeader title="Platform settings" description="Defaults for every organization." />
      {settings.isPending ? (
        <SkeletonForm fields={3} label="Loading settings" />
      ) : settings.isError ? (
        <ErrorState
          message={describeError(settings.error)}
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <Card>
          <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-lg flex-col gap-4">
            <FormError message={formError} />
            <TextField
              label="Tala API address"
              type="url"
              hint="An https:// origin on the server's approved host list that resolves to a public address. Leave empty to keep the Tala module unavailable."
              error={formState.errors.tala_api_base_url?.message}
              {...register('tala_api_base_url')}
            />
            <TextField
              label="Minimum password length"
              type="number"
              hint="Organizations may raise this, never lower it."
              error={formState.errors.password_min_length?.message}
              {...register('password_min_length')}
            />
            <TextField
              label="Upload size limit (MB)"
              type="number"
              error={formState.errors.upload_max_mb?.message}
              {...register('upload_max_mb')}
            />
            <div>
              <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
                Save settings
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
