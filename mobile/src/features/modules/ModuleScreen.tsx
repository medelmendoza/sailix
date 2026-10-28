import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { talaModule } from '@sailix/tala';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, EmptyState, FormError, Screen } from '@/components';
import { colors, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { ServiceLogo, hasLogo } from '@/features/services/ServiceLogo';
import { useSessionStore } from '@/store/sessionStore';
import { STATUS_DESCRIPTION, STATUS_LABEL } from './availability';
import { talaPackageEnabled, useTalaHost } from './talaHost';
import { useUnlinkTala } from './tala/api';
import { TalaCourseList } from './tala/TalaCourseList';
import { TalaLinkForm } from './tala/TalaLinkForm';

type Props = NativeStackScreenProps<AppStackParamList, 'Module'>;

/** Module entry: what the API says about the caller's access (`/me.modules`), plus the Tala gateway screens. */
export function ModuleScreen({ route, navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const module = me?.modules.find((m) => m.code === route.params.code);
  const unlink = useUnlinkTala();
  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const host = useTalaHost(goBack);
  const [error, setError] = useState<string | null>(null);

  if (!module) {
    return (
      <Screen>
        <EmptyState
          title="Service not available"
          description="This service is not available for your account."
        />
      </Screen>
    );
  }

  if (module.code === 'tala' && module.enabled && talaPackageEnabled() && host) {
    return <talaModule.Root host={host} />;
  }

  const statusCard = (
    <Card style={styles.status}>
      {hasLogo(module.code) ? <ServiceLogo code={module.code} size={56} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="caption" style={{ color: colors.textMuted }}>
          Status
        </AppText>
        <AppText variant="heading">{STATUS_LABEL[module.status] ?? module.status}</AppText>
        <AppText muted>{STATUS_DESCRIPTION[module.status] ?? ''}</AppText>
      </View>
    </Card>
  );

  function confirmDisconnect() {
    Alert.alert(
      'Disconnect Tala?',
      'Sailix removes its saved link to your Tala account. Your Tala account itself is not changed. You can link it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setError(null);
            unlink.mutate(undefined, { onError: (e) => setError(describeError(e)) });
          },
        },
      ],
    );
  }

  if (module.code === 'tala' && module.enabled && module.status === 'linked') {
    return (
      <Screen padded={false}>
        <TalaCourseList
          header={
            <View style={styles.wrap}>
              {statusCard}
              <FormError message={error} />
              <View style={styles.actions}>
                <Button
                  title="My stats"
                  style={styles.action}
                  onPress={() => navigation.navigate('TalaStats')}
                />
                <Button
                  title="Join a course"
                  variant="secondary"
                  style={styles.action}
                  onPress={() => navigation.navigate('TalaJoinCourse')}
                />
              </View>
            </View>
          }
          footer={
            <Button
              title="Disconnect Tala"
              variant="secondary"
              loading={unlink.isPending}
              onPress={confirmDisconnect}
            />
          }
        />
      </Screen>
    );
  }

  const canLink =
    module.code === 'tala' &&
    module.enabled &&
    (module.status === 'not_linked' || module.status === 'needs_relink');

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={[styles.wrap, { padding: spacing.lg }]}>
        {module.code === 'tala' ? null : (
          <AppText variant="title" accessibilityRole="header">
            {module.label}
          </AppText>
        )}
        {statusCard}
        {canLink ? <TalaLinkForm relink={module.status === 'needs_relink'} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
