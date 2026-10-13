import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button, FormError, TextField } from '../../components/ui';
import { api, ensureCsrf } from '../../services/api/client';
import { applyServerErrors } from './forms';
import { PublicLayout } from './PublicLayout';

const schema = z.object({ email: z.email('Enter a valid email address.') });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await ensureCsrf();
      await api.post('/auth/forgot-password', values);
      setSent(true);
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['email']));
    }
  }

  if (sent) {
    return (
      <PublicLayout title="Check your email">
        {/* Same text whether or not the address has an account: the API never reveals that. */}
        <p className="text-sm">
          If an account exists for that address, we have sent a link to reset the password. The link
          works once and expires in 60 minutes.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Reset your password" subtitle="We will email you a reset link.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" loading={isSubmitting}>
          Send reset link
        </Button>
        <Link to="/login" className="text-center text-sm text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </form>
    </PublicLayout>
  );
}
