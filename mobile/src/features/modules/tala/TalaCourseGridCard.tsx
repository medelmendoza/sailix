import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, CourseImage, ProgressBar } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import type { TalaCourse } from '@/services/api/types';
import { dueInfo, type Due } from './stats';

const INK: Record<Due['tone'], string> = {
  done: colors.success,
  overdue: colors.danger,
  soon: colors.warning,
  ok: colors.textMuted,
  upcoming: colors.textMuted,
};

/** A course as a compact tile for the two-column view: picture, title, a thin bar and how far along it is. */
export function TalaCourseGridCard({
  course,
  onPress,
}: {
  course: TalaCourse;
  onPress: () => void;
}) {
  const due = dueInfo(course);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.name}, ${course.completed} of ${course.total} items completed`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <Card variant="flat" style={styles.card}>
        <CourseImage uri={course.thumbnail_url} title={course.name} style={styles.picture} />
        <View style={styles.body}>
          <AppText numberOfLines={2} style={styles.title}>
            {course.name}
          </AppText>
          <ProgressBar percent={course.percent} label={`${course.name} progress`} />
          <AppText variant="caption" muted>
            {course.completed} of {course.total} done
          </AppText>
          {due ? (
            <AppText variant="caption" numberOfLines={1} style={{ color: INK[due.tone] }}>
              {due.text}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { width: '48.5%' },
  card: { padding: 0, borderRadius: radius.lg, overflow: 'hidden', flex: 1 },
  picture: { height: 104, width: '100%' },
  body: { padding: spacing.md, gap: spacing.sm },
  title: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    minHeight: 40,
  },
  pressed: { opacity: 0.8 },
});
