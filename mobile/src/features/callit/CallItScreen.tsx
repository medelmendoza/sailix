import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, SkeletonList } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { useCallItStats } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'CallIt'>;

export function CallItScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const stats = useCallItStats();
  const name = me?.profile?.first_name ?? me?.user.display_name ?? me?.user.username ?? '';

  if (stats.isError)
    return <ErrorState message={describeError(stats.error)} onRetry={() => void stats.refetch()} />;
  if (!stats.data) return <SkeletonList />;
  const { reports_made, badges, next_badge } = stats.data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        Welcome, {name}
      </AppText>
      <AppText muted>
        Call it out: report an unsafe act, condition or behaviour so it can be fixed before someone
        gets hurt.
      </AppText>
      <Card style={styles.card}>
        <AppText variant="caption" muted>
          Reports made
        </AppText>
        <AppText variant="title" accessibilityLabel={`${reports_made} reports made`}>
          {reports_made}
        </AppText>
        <AppText variant="heading" accessibilityRole="header">
          Medals
        </AppText>
        {badges.length === 0 ? (
          <AppText muted>Send your first report to earn your first medal.</AppText>
        ) : (
          <View style={styles.badges}>
            {badges.map((b) => (
              <View
                key={b.reports}
                style={styles.badge}
                accessible
                accessibilityLabel={`Medal: ${b.label}`}
              >
                <AppText variant="caption" style={{ color: colors.onPrimary }}>
                  {b.label}
                </AppText>
              </View>
            ))}
          </View>
        )}
        {next_badge ? (
          <AppText variant="caption" muted>
            Next medal at {next_badge} reports.
          </AppText>
        ) : null}
      </Card>
      <Button title="Create a new report" onPress={() => navigation.navigate('CallItForm', {})} />
      <Button
        title="My reports"
        variant="secondary"
        onPress={() => navigation.navigate('CallItReports')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
