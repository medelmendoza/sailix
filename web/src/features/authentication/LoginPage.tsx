import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Lock, User } from 'lucide-react';
import { z } from 'zod';
import { Button, FormError, TextField } from '../../components/ui';
import { api, ensureCsrf } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import { applyServerErrors } from './forms';
import { useTenantLook } from '../tenant-look/TenantLookProvider';
import { PublicLayout } from './PublicLayout';

const schema = z.object({
  username: z.string().min(1, 'Enter your username or email.'),
  password: z.string().min(1, 'Enter your password.'),
  agency_code: z.string().max(32).optional(),
});
type Values = z.infer<typeof schema>;

interface Selection {
  ticket: string;
  memberships: Array<{ id: string; role: string; tenant: { code: string; name: string } }>;
}

/** The sign-in of an organization's people: administrators at `/login`, crew at `/portal/login`. */
export function LoginPage({ variant = 'admin' }: { variant?: 'admin' | 'crew' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const look = useTenantLook(); // on an organization's own address the address names it: no agency code to type
  const [formError, setFormError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const crew = variant === 'crew';
  const from = (location.state as { from?: string } | null)?.from ?? (crew ? '/portal' : '/app');

  async function done() {
    queryClient.clear(); // never reuse another session's cached data
    await navigate(from, { replace: true });
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await ensureCsrf();
      const res = await api.post('/auth/session', {
        ...values,
        agency_code: look ? undefined : values.agency_code || undefined,
      });
      if (res.data.data.requires_tenant_selection) {
        setSelection({ ticket: res.data.data.ticket, memberships: res.data.data.memberships });
        return;
      }
      await done();
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['username', 'password', 'agency_code']));
    }
  }

  async function choose(membershipId: string) {
    if (!selection) return;
    setBusyId(membershipId);
    setFormError(null);
    try {
      await ensureCsrf();
      await api.post('/auth/session/select', {
        ticket: selection.ticket,
        membership_id: membershipId,
      });
      await done();
    } catch (e) {
      setFormError(describeError(e));
      setSelection(null); // the single-use ticket is spent: start over
    } finally {
      setBusyId(null);
    }
  }

  if (selection) {
    return (
      <PublicLayout
        title="Choose an organization"
        subtitle="Your account belongs to more than one organization."
      >
        <ul className="flex flex-col gap-2">
          {selection.memberships.map((m) => (
            <li key={m.id}>
              <Button
                variant="secondary"
                className="w-full justify-between"
                loading={busyId === m.id}
                disabled={busyId !== null}
                onClick={() => void choose(m.id)}
              >
                <span>{m.tenant.name}</span>
                <span className="text-xs text-muted">{m.role.replace('_', ' ')}</span>
              </Button>
            </li>
          ))}
        </ul>
        <FormError message={formError} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout
      title={crew ? 'Crew sign in' : 'Administrator sign in'}
      subtitle={
        crew
          ? 'Your documents, announcements, to-dos and payslips.'
          : 'Organization administrators only. Crew members sign in to the client portal.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Username or email"
          icon={<User />}
          autoComplete="username"
          error={errors.username?.message}
          {...register('username')}
        />
        <TextField
          label="Password"
          icon={<Lock />}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {look ? null : (
          <TextField
            label="Agency code (optional)"
            icon={<Building2 />}
            autoComplete="organization"
            hint="Only needed if you belong to several organizations."
            error={errors.agency_code?.message}
            {...register('agency_code')}
          />
        )}
        <Button type="submit" loading={isSubmitting}>
          Sign in
        </Button>
        <Link to="/forgot-password" className="text-center text-sm text-accent-600 hover:underline">
          Forgot your password?
        </Link>
        <Link
          to={crew ? '/login' : '/portal/login'}
          className="text-center text-sm text-muted hover:underline"
        >
          {crew ? 'Administrator? Sign in here' : 'Crew member? Sign in to the client portal'}
        </Link>
      </form>
    </PublicLayout>
  );
}
