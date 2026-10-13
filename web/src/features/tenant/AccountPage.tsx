import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, FormError, PageHeader, TextField, useToast } from '../../components/ui';
import { api } from '../../services/api/client';
import { applyServerErrors } from '../authentication/forms';
import { useMe } from '../authentication/session';

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    password_confirmation: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The passwords do not match.',
  })
  .refine((v) => v.password !== v.current_password, {
    path: ['password'],
    message: 'Choose a different password.',
  });
type Values = z.infer<typeof schema>;

export function AccountPage() {
  const me = useMe();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.put('/me/password', values);
      toast.success('Password changed. Your other devices were signed out.');
      reset();
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['current_password', 'password']));
    }
  }

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>
              {me.profile
                ? `${me.profile.first_name} ${me.profile.last_name}`
                : (me.user.display_name ?? '—')}
            </dd>
            <dt className="text-muted">Username</dt>
            <dd>{me.user.username}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{me.user.email}</dd>
            <dt className="text-muted">Organization</dt>
            <dd>{me.tenant.name}</dd>
            <dt className="text-muted">Role</dt>
            <dd>{me.membership.role === 'tenant_admin' ? 'Administrator' : 'Crew'}</dd>
          </dl>
        </Card>
        <Card title="Change password">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormError message={formError} />
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={errors.current_password?.message}
              {...register('current_password')}
            />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Repeat the new password"
              type="password"
              autoComplete="new-password"
              error={errors.password_confirmation?.message}
              {...register('password_confirmation')}
            />
            <div>
              <Button type="submit" loading={isSubmitting}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
