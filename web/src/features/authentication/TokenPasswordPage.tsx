import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, FormError, TextField } from '../../components/ui';
import { api, ensureCsrf } from '../../services/api/client';
import { applyServerErrors } from './forms';
import { PublicLayout } from './PublicLayout';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    password_confirmation: z.string().min(1, 'Repeat the password.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The passwords do not match.',
  });
type Values = z.infer<typeof schema>;

interface Props {
  kind: 'reset' | 'invitation';
}

/**
 * Shared screen for the two emailed one-time links (password reset, administrator invitation).
 * The secret is read once and the address bar is cleaned immediately so it does not stay in history or leak via Referer.
 */
export function TokenPasswordPage({ kind }: Props) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [secret] = useState(() => ({
    token: params.get('token') ?? '',
    email: params.get('email') ?? '',
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (location.search) void navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const title = kind === 'reset' ? 'Choose a new password' : 'Activate your account';
  const usable = kind === 'reset' ? secret.token && secret.email : secret.token;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await ensureCsrf();
      if (kind === 'reset') {
        await api.post('/auth/reset-password', { ...secret, ...values });
      } else {
        await api.post('/auth/invitations/accept', { token: secret.token, ...values });
      }
      setDone(true);
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['password']));
    }
  }

  if (done) {
    return (
      <PublicLayout title={kind === 'reset' ? 'Password changed' : 'Account activated'}>
        <p className="text-sm">
          {kind === 'reset'
            ? 'Your password was changed and you were signed out everywhere.'
            : 'Your account is active. You can sign in now.'}
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm font-medium text-accent-600 hover:underline"
        >
          Go to sign in
        </Link>
      </PublicLayout>
    );
  }

  if (!usable) {
    return (
      <PublicLayout title="This link is not valid">
        <p className="text-sm">
          The link is incomplete. Open the latest email again, or request a new link.
        </p>
        <Link
          to={kind === 'reset' ? '/forgot-password' : '/login'}
          className="mt-4 inline-block text-sm text-accent-600 hover:underline"
        >
          {kind === 'reset' ? 'Request a new link' : 'Go to sign in'}
        </Link>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title={title}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Repeat the password"
          type="password"
          autoComplete="new-password"
          error={errors.password_confirmation?.message}
          {...register('password_confirmation')}
        />
        <Button type="submit" loading={isSubmitting}>
          {kind === 'reset' ? 'Change password' : 'Activate account'}
        </Button>
      </form>
    </PublicLayout>
  );
}
