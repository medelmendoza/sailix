import { useState } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  FormError,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { hasFeature, useLogout, useMe } from '../authentication/session';
import { useChangeMyPassword, useRequestDeletion, useSendFeedback } from './api';

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

function ChangePassword() {
  const change = useChangeMyPassword();
  const toast = useToast();
  const [v, setV] = useState({ current: '', next: '', again: '' });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.current || !v.next) return setError('Fill in your current and your new password.');
    if (v.next !== v.again) return setError('The new password and its repeat are not the same.');
    setError(null);
    try {
      await change.mutateAsync({
        current_password: v.current,
        password: v.next,
        password_confirmation: v.again,
      });
      setV({ current: '', next: '', again: '' });
      toast.success('Password changed. Other devices are signed out.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3">
        <FormError message={error} />
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={v.current}
          onChange={(e) => setV({ ...v, current: e.target.value })}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={v.next}
          onChange={(e) => setV({ ...v, next: e.target.value })}
        />
        <TextField
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          value={v.again}
          onChange={(e) => setV({ ...v, again: e.target.value })}
        />
        <div>
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Feedback() {
  const send = useSendFeedback();
  const toast = useToast();
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return setError('Write your message.');
    setError(null);
    try {
      await send.mutateAsync({ category, message: message.trim() });
      setMessage('');
      toast.success('Thank you. Your feedback was sent.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card
      title="Send feedback"
      description="About this app only. It goes to your organization's administrators."
    >
      <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3">
        <FormError message={error} />
        <SelectField
          label="What is it about?"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          options={[
            { value: 'idea', label: 'An idea' },
            { value: 'bug', label: 'Something is wrong' },
            { value: 'other', label: 'Something else' },
          ]}
        />
        <TextAreaField
          label="Your message"
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div>
          <Button type="submit" loading={send.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Who you are here, and what you can do about your account: password, feedback, deletion, signing out. */
export function PortalAccountPage() {
  const me = useMe();
  const logout = useLogout('tenant', '/portal/login');
  const deletion = useRequestDeletion();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const p = me.profile;
  const fullName =
    [p?.first_name, p?.middle_name, p?.last_name].filter(Boolean).join(' ') ||
    me.user.display_name ||
    me.user.username;

  return (
    <>
      <PageHeader title="Account" description="Your details and your account's settings." />
      <div className="flex max-w-3xl flex-col gap-6">
        <Card title="Your details">
          <dl className="divide-y divide-line">
            <Row label="Name" value={fullName} />
            <Row label="Username" value={me.user.username} />
            <Row label="Email" value={me.user.email} />
            <Row label="Organization" value={me.tenant.name} />
            <Row label="Crew ID" value={p?.crew_number} />
            <Row label="Rank" value={p?.rank} />
            <Row label="Fleet" value={p?.fleet} />
          </dl>
        </Card>

        <ChangePassword />
        {hasFeature(me, 'feedback') && <Feedback />}

        <Card
          title="Your account"
          description="Signing out ends this session. Deleting your account is a request your organization answers."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
              Sign out
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Request account deletion
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Ask for your account to be deleted?"
        description="Your organization is told. Nothing is deleted until they decide, and you can keep using the portal meanwhile."
        confirmLabel="Send the request"
        destructive
        loading={deletion.isPending}
        onConfirm={() =>
          deletion.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false);
              toast.success('Your request was sent.');
            },
            onError: (e) => {
              setConfirming(false);
              toast.error(describeError(e));
            },
          })
        }
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
