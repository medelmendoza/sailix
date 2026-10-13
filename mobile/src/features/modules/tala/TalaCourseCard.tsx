import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, CourseImage, GlyphIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import type { TalaCourse } from '@/services/api/types';
import { TalaCourseProgress } from './TalaCourseProgress';
import { dueInfo } from './stats';

/**
 * A course in the list, laid out as in the original Tala app: a large picture with the title over its lower edge, then one
 * row with who made it (left) and the time left (right). Progress, which the original showed elsewhere, sits underneath.
 */
export function TalaCourseCard({ course, onPress }: { course: TalaCourse; onPress: () => void }) {
  const due = dueInfo(course);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.name}, ${course.completed} of ${course.total} items completed`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Card style={styles.card}>
        <View style={styles.clip}>
          <View>
            <CourseImage uri={course.thumbnail_url} title={course.name} style={styles.picture} />
            <View style={styles.titleBand}>
              <AppText numberOfLines={2} style={styles.title}>
                {course.name}
              </AppText>
            </View>
          </View>
          <View style={styles.body}>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <GlyphIcon name="person" size={20} />
                <AppText numberOfLines={1} style={styles.factText}>
                  {course.creator ?? 'Unknown creator'}
                </AppText>
              </View>
              <View style={styles.fact}>
                <GlyphIcon name="clock" size={20} />
                <AppText numberOfLines={1} style={styles.factText}>
                  {due?.text ?? 'No due date'}
                </AppText>
              </View>
            </View>
            <TalaCourseProgress course={course} showDue={false} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  picture: { height: 220, width: '100%' },
  titleBand: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.md,
    bottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    // white text must stay readable over any picture: a dark translucent band, as in the original
    backgroundColor: 'rgba(20, 28, 40, 0.68)',
  },
  title: { ...typography.heading, fontSize: 20, lineHeight: 26, color: colors.onPrimary },
  body: { padding: spacing.xl, gap: spacing.md },
  facts: { flexDirection: 'row', gap: spacing.md },
  fact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget / 2,
  },
  factText: { flex: 1, ...typography.caption, color: colors.text },
  pressed: { opacity: 0.8 },
});
