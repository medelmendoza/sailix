import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  otp: z.string().optional(), // not on the form when this environment asks for no code
});
type Values = z.infer<typeof schema>;
const CODE = /^[0-9]{6}$/;

/** Does signing in here need a one-time code? Yes, unless this is a development machine that switched it off. */
function useOtpRequired() {
  return useQuery({
    queryKey: ['platform-login-options'],
    queryFn: async () =>
      (await api.get<{ data: { otp_required: boolean } }>('/platform/auth/options')).data.data
        .otp_required,
    retry: false,
    staleTime: Infinity,
  });
}

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const options = useOtpRequired();
  // if the answer cannot be had, ask for the code: the safe default
  const otpRequired = options.data ?? true;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    if (otpRequired && !CODE.test(values.otp ?? '')) {
      return setError('otp', { message: 'Enter the 6-digit code from your authenticator app.' });
    }
    try {
      await ensureCsrf();
      await api.post('/platform/auth/session', {
        email: values.email,
        password: values.password,
        ...(otpRequired ? { otp: values.otp } : {}),
      });
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
      subtitle={
        otpRequired
          ? 'Superadministrators only. A one-time code is required.'
          : 'Superadministrators only.'
      }
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
        {options.isPending ? null : otpRequired ? (
          <TextField
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={errors.otp?.message}
            {...register('otp')}
          />
        ) : null}
        <Button type="submit" loading={isSubmitting} disabled={options.isPending}>
          Sign in
        </Button>
      </form>
    </PublicLayout>
  );
}
