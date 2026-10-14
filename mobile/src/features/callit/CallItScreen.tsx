import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, GlyphIcon, SkeletonList } from '@/components';
import { colors, gradients, radius, spacing } from '@/constants/theme';
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
      <View style={styles.hero}>
        <AppText style={styles.heroSmall}>Welcome,</AppText>
        <AppText variant="title" accessibilityRole="header" style={styles.heroName}>
          {name}
        </AppText>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <GlyphIcon name="chart" size={40} />
            <View>
              <AppText variant="heading">Reports made</AppText>
              <AppText
                variant="title"
                style={{ color: colors.primary }}
                accessibilityLabel={`${reports_made} reports made`}
              >
                {reports_made}
              </AppText>
            </View>
          </View>
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
                  <GlyphIcon name="medal" size={44} color={colors.gold} />
                  <AppText variant="caption" style={styles.badgeLabel}>
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
          <Button
            title="My reports"
            variant="secondary"
            onPress={() => navigation.navigate('CallItReports')}
          />
        </Card>
        <AppText muted>
          Call it out: report an unsafe act, condition or behaviour so it can be fixed before
          someone gets hurt.
        </AppText>
        <Button title="Create a new report" onPress={() => navigation.navigate('CallItForm', {})} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  hero: {
    padding: spacing.xl,
    gap: spacing.xs,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    experimental_backgroundImage: gradients.header,
  },
  heroSmall: { color: colors.onPrimary },
  heroName: { color: colors.onPrimary },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'space-around',
  },
  badge: { alignItems: 'center', gap: spacing.xs, maxWidth: 110 },
  badgeLabel: { textAlign: 'center' },
});
