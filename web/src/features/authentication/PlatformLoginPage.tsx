import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, FormError, TextField } from '../../components/ui';
import { api, ensureCsrf } from '../../services/api/client';
import { applyServerErrors } from './forms';
import { PublicLayout } from './PublicLayout';

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  otp: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});
type Values = z.infer<typeof schema>;

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await ensureCsrf();
      await api.post('/platform/auth/session', values);
      queryClient.clear();
      await navigate((location.state as { from?: string } | null)?.from ?? '/platform', {
        replace: true,
      });
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['email', 'password', 'otp']));
      reset({ ...values, otp: '' }); // a code is single-use: always ask for a fresh one
    }
  }

  return (
    <PublicLayout
      title="Platform sign in"
      subtitle="Superadministrators only. A one-time code is required."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Authenticator code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={errors.otp?.message}
          {...register('otp')}
        />
        <Button type="submit" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </PublicLayout>
  );
}
