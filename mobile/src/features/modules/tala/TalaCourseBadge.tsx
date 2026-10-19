import { StyleSheet, View } from 'react-native';
import { AppText, GlyphIcon } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import type { TalaCourse } from '@/services/api/types';

/** The corner badge on a course picture: how far along it is, at a glance. */
export function TalaCourseBadge({ course }: { course: Pick<TalaCourse, 'state' | 'percent'> }) {
  const done = course.state === 'completed';
  const started = course.state === 'in_progress';
  const ink = done ? colors.success : started ? colors.primary : colors.textMuted;
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
      {done ? <GlyphIcon name="check" size={14} color={ink} /> : null}
      <AppText variant="caption" style={[styles.text, { color: ink }]}>
        {done ? 'Done' : started ? `${course.percent}%` : 'Not started'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  text: { fontFamily: 'Quicksand_700Bold' },
});
