import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, EmptyState, ErrorState, SkeletonList } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useCallItReports } from './api';
import { CLASSIFICATIONS, LOCATIONS, STATUS_LABEL, labelOf } from './content';

type Props = NativeStackScreenProps<AppStackParamList, 'CallItReports'>;

const BADGE = {
  draft: { color: colors.textMuted, bg: colors.surfaceSunken },
  submitted: { color: colors.warning, bg: colors.warningBg },
  reviewed: { color: colors.success, bg: colors.successBg },
} as const;

export function ReportsScreen({ navigation }: Props) {
  const list = useCallItReports();
  if (list.isError)
    return <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />;
  if (!list.data) return <SkeletonList />;
  if (list.data.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          title="No reports yet"
          description="Reports and drafts you write will appear here."
        />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {list.data.data.map((r) => {
        const b = BADGE[r.status];
        const what = labelOf(CLASSIFICATIONS, r.classification) || 'Report in progress';
        const where =
          r.location === 'others' && r.location_other
            ? r.location_other
            : labelOf(LOCATIONS, r.location);
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${what}, ${STATUS_LABEL[r.status]}`}
            onPress={() =>
              r.status === 'draft'
                ? navigation.navigate('CallItForm', { id: r.id })
                : navigation.navigate('CallItReport', { id: r.id })
            }
            style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
          >
            <Card style={styles.card}>
              <View style={styles.head}>
                <AppText variant="heading" style={{ flex: 1 }}>
                  {what}
                </AppText>
                <View style={[styles.badge, { backgroundColor: b.bg }]}>
                  <AppText variant="caption" style={{ color: b.color }}>
                    {STATUS_LABEL[r.status]}
                  </AppText>
                </View>
              </View>
              <AppText muted numberOfLines={2}>
                {[where, r.vessel].filter(Boolean).join(' · ') || 'No details yet'}
              </AppText>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  press: { minHeight: minTouchTarget },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
});
