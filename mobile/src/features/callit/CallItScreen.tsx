import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import {
  AppText,
  ErrorState,
  GlassBackground,
  GlassButton,
  GlassCard,
  GlyphIcon,
  SkeletonList,
  useGlassHeader,
} from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { useCallItStats } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'CallIt'>;

export function CallItScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const stats = useCallItStats();
  useGlassHeader();
  const name = me?.profile?.first_name ?? me?.user.display_name ?? me?.user.username ?? '';

  if (stats.isError)
    return <ErrorState message={describeError(stats.error)} onRetry={() => void stats.refetch()} />;
  if (!stats.data) return <SkeletonList />;
  const { reports_made, badges, next_badge } = stats.data;

  return (
    <GlassBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText style={styles.white}>Welcome,</AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.white}>
            {name}
          </AppText>
        </View>
        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <GlyphIcon name="chart" size={40} color="#FFFFFF" />
            <View>
              <AppText variant="heading" style={styles.white}>
                Reports made
              </AppText>
              <AppText
                variant="title"
                style={styles.white}
                accessibilityLabel={`${reports_made} reports made`}
              >
                {reports_made}
              </AppText>
            </View>
          </View>
          <AppText variant="heading" accessibilityRole="header" style={styles.white}>
            Medals
          </AppText>
          {badges.length === 0 ? (
            <AppText style={styles.white}>Send your first report to earn your first medal.</AppText>
          ) : (
            <View style={styles.badges}>
              {badges.map((b) => (
                <View
                  key={b.reports}
                  style={styles.badge}
                  accessible
                  accessibilityLabel={`Medal: ${b.label}`}
                >
                  <GlyphIcon name="medal" size={44} color="#FFD27A" />
                  <AppText variant="caption" style={[styles.white, styles.badgeLabel]}>
                    {b.label}
                  </AppText>
                </View>
              ))}
            </View>
          )}
          {next_badge ? (
            <AppText variant="caption" style={styles.white}>
              Next medal at {next_badge} reports.
            </AppText>
          ) : null}
          <GlassButton title="My reports" onPress={() => navigation.navigate('CallItReports')} />
        </GlassCard>
        <AppText style={styles.white}>
          Call it out: report an unsafe act, condition or behaviour so it can be fixed before
          someone gets hurt.
        </AppText>
        <GlassButton
          solid
          title="Create a new report"
          onPress={() => navigation.navigate('CallItForm', {})}
        />
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.xs, paddingVertical: spacing.sm },
  white: { color: '#FFFFFF' },
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
