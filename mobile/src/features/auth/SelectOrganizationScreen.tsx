import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import type { AuthStackParamList } from '@/app/navigation/types';
import { AuthLayout, Button, FormError } from '@/components';
import { api, PUBLIC_CALL } from '@/services/api/client';
import { describeError, toApiError } from '@/services/api/errors';
import type { Envelope, TokenGrant } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'SelectOrganization'>;

const ROLE_LABEL: Record<string, string> = { tenant_admin: 'Administrator', crew: 'Crew' };

/** Second sign-in step for people in several organizations. The single-use ticket proves the first step. */
export function SelectOrganizationScreen({ route, navigation }: Props) {
  const { ticket, memberships } = route.params;
  const completeSignIn = useSessionStore((s) => s.completeSignIn);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(membershipId: string) {
    setBusyId(membershipId);
    setError(null);
    try {
      const res = await api.post<Envelope<TokenGrant>>(
        '/auth/token/select',
        { ticket, membership_id: membershipId },
        PUBLIC_CALL,
      );
      await completeSignIn(res.data.data);
    } catch (e) {
      const message = describeError(e);
      if (toApiError(e).code === 'invalid_ticket') {
        // the ticket is single-use: once it failed or expired the person must start again,
        // and the sign-in screen explains why
        useSessionStore.getState().setNotice(message);
        navigation.popToTop();
      } else {
        setError(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AuthLayout
      title="Choose an organization"
      subtitle="Your account belongs to more than one organization."
    >
      <FormError message={error} />
      {memberships.map((m) => (
        <Button
          key={m.id}
          variant="secondary"
          title={`${m.tenant.name} · ${ROLE_LABEL[m.role] ?? m.role}`}
          accessibilityLabel={`${m.tenant.name}, ${ROLE_LABEL[m.role] ?? m.role}`}
          loading={busyId === m.id}
          disabled={busyId !== null}
          onPress={() => void choose(m.id)}
        />
      ))}
    </AuthLayout>
  );
}
