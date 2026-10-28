import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, CourseImage, GlyphIcon } from '../ui';
import { colors, radius, spacing } from '../ui/theme';
import type { TalaCourse } from '../types';
import { TalaCourseProgress } from './TalaCourseProgress';
import { dueInfo, type Due } from './stats';

/** The chip colours for the time left. */
const CHIP: Record<Due['tone'], { bg: string; ink: string }> = {
  done: { bg: colors.successBg, ink: colors.success },
  overdue: { bg: colors.dangerBg, ink: colors.danger },
  soon: { bg: colors.warningBg, ink: colors.warning },
  ok: { bg: colors.surfaceSunken, ink: colors.textMuted },
  upcoming: { bg: colors.surfaceSunken, ink: colors.textMuted },
};

/**
 * A course in the list: its picture, the title, a chip with the time left, who made it, and how far the learner is.
 */
export function TalaCourseCard({ course, onPress }: { course: TalaCourse; onPress: () => void }) {
  const due = dueInfo(course);
  const chip = due ? CHIP[due.tone] : CHIP.ok;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.name}, ${course.completed} of ${course.total} items completed`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Card variant="flat" style={styles.card}>
        <CourseImage uri={course.thumbnail_url} title={course.name} style={styles.picture} />
        <View style={styles.body}>
          <AppText numberOfLines={2} style={styles.title}>
            {course.name}
          </AppText>
          <View style={styles.facts}>
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              <GlyphIcon name="clock" size={16} color={chip.ink} />
              <AppText variant="caption" style={{ color: chip.ink }}>
                {due?.text ?? 'No due date'}
              </AppText>
            </View>
            <View style={styles.fact}>
              <GlyphIcon name="person" size={16} color={colors.textMuted} />
              <AppText variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {course.creator ?? 'Unknown creator'}
              </AppText>
            </View>
          </View>
          <TalaCourseProgress course={course} showDue={false} showPercent />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, borderRadius: radius.lg, overflow: 'hidden' },
  picture: { height: 150, width: '100%' },
  body: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: 'Quicksand_700Bold', fontSize: 19, lineHeight: 25, color: colors.text },
  facts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
