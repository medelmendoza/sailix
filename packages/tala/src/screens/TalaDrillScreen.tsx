import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTalaCourses } from '../data/api';
import { describeError } from '../errors';
import type { TalaRoutes } from '../routes';
import { AppText, Card, EmptyState, ErrorState, Notice } from '../ui';
import { spacing } from '../ui/theme';
import { DrillSkeleton } from './TalaSkeletons';
import { savedCopyText } from './TalaCourseList';
import { TalaCourseProgress } from './TalaCourseProgress';
import { byUrgency } from './stats';

type Props = NativeStackScreenProps<TalaRoutes, 'TalaDrill'>;

/** The courses behind one number on the dashboard (a slice of a chart, a week on the line); each opens the course. */
export function TalaDrillScreen({ route }: Props) {
  const { ids } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
  const courses = useTalaCourses();
  if (courses.isPending) return <DrillSkeleton />;
  if (courses.isError) {
    return <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />;
  }
  const list = byUrgency(courses.data.data.filter((c) => ids.includes(c.id)));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {courses.data.fromCache ? <Notice message={savedCopyText(courses.data.fetchedAt)} /> : null}
      {list.length === 0 ? (
        <EmptyState title="No courses" description="There are no courses to show here." />
      ) : (
        list.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${c.completed} of ${c.total} items completed`}
            accessibilityHint="Opens this course"
            onPress={() => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })}
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
          >
            <Card variant="flat" style={styles.row}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText style={styles.name}>{c.name}</AppText>
                <TalaCourseProgress course={c} />
              </View>
              <AppText muted>›</AppText>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: 'Nunito_700Bold' },
});
