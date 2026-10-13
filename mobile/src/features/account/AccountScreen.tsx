import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { env } from '@/app/config/env';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Button, Card, FormError, Notice } from '@/components';
import { spacing } from '@/constants/theme';
import { api } from '@/services/api/client';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Account'>,
  NativeStackScreenProps<AppStackParamList>
>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" muted style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText style={styles.rowValue}>{value}</AppText>
    </View>
  );
}

export function AccountScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const signOut = useSessionStore((s) => s.signOut);
  const switchOrganization = useSessionStore((s) => s.switchOrganization);
  const [switching, setSwitching] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  if (!me) return null;
  const fullName = me.profile
    ? [me.profile.first_name, me.profile.last_name].filter(Boolean).join(' ')
    : (me.user.display_name ?? me.user.username);

  const others = me.memberships.filter((m) => !m.current);

  async function openPrivacy() {
    setError(null);
    try {
      await Linking.openURL(env.privacyUrl);
    } catch {
      setError('Could not open the privacy policy. Try again later.');
    }
  }

  async function switchTo(membershipId: string) {
    setError(null);
    setSwitching(membershipId);
    try {
      await switchOrganization(membershipId);
    } catch {
      setSwitching(null); // the reason is in the store (this screen is remounted during a switch)
    }
  }

  function confirmDeletion() {
    Alert.alert(
      'Request account deletion?',
      'Your organization is notified and decides how your account is handled. Nothing is deleted right away and you keep access until they act.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRequesting(true);
              setError(null);
              try {
                await api.post('/me/deletion-request');
                setInfo('Your deletion request was sent to your organization.');
              } catch (e) {
                setError(describeError(e));
              } finally {
                setRequesting(false);
              }
            })();
          },
        },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        Account
      </AppText>
      {info ? <Notice tone="success" message={info} /> : null}
      <FormError message={error} />
      <Card style={{ gap: spacing.md }}>
        <Row label="Name" value={fullName} />
        <Row label="Username" value={me.user.username} />
        <Row label="Email" value={me.user.email} />
        <Row label="Organization" value={me.tenant.name} />
        <Row
          label="Role"
          value={me.membership.role === 'tenant_admin' ? 'Administrator' : 'Crew'}
        />
      </Card>
      {others.length > 0 ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading" accessibilityRole="header">
            Switch organization
          </AppText>
          {others.map((m) => (
            <Button
              key={m.id}
              title={`${m.tenant.name} (${m.role === 'tenant_admin' ? 'Administrator' : 'Crew'})`}
              variant="secondary"
              loading={switching === m.id}
              disabled={switching !== null}
              onPress={() => void switchTo(m.id)}
            />
          ))}
        </Card>
      ) : null}
      <Button
        title="Change password"
        variant="secondary"
        onPress={() => navigation.navigate('ChangePassword')}
      />
      <Button
        title="Send feedback"
        variant="secondary"
        onPress={() => navigation.navigate('SendFeedback')}
      />
      <Button title="Privacy policy" variant="secondary" onPress={() => void openPrivacy()} />
      <Button
        title="Request account deletion"
        variant="secondary"
        loading={requesting}
        onPress={confirmDeletion}
      />
      <Button title="Sign out" onPress={confirmSignOut} />
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Version {Constants.expoConfig?.version ?? '—'}
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { gap: 2 },
  rowLabel: {},
  rowValue: {},
});
