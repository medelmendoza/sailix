import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTalaCourses } from '../data/api';
import { describeError } from '../errors';
import { AppText, Card, EmptyState, ErrorState, Notice, ProgressBar, SkeletonList } from '../ui';
import { colors, spacing } from '../ui/theme';
import { onTabScroll } from '../ui/tabBarCollapse';
import { savedCopyText } from './TalaCourseList';
import { byUrgency, dueInfo, type Due } from './stats';

const TONE: Record<Due['tone'], string> = {
  done: colors.success,
  overdue: colors.danger,
  soon: colors.warning,
  ok: colors.textMuted,
  upcoming: colors.textMuted,
};

/**
 * The home tab of the Tala app: "My Stats" (how far each course is) and "Due Dates" (what is due, soonest first).
 * Read-only: it shows the numbers and opens nothing; courses are opened from My Courses.
 */
export function TalaDashboard() {
  const courses = useTalaCourses();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  if (courses.isPending) return <SkeletonList />;
  if (courses.isError) {
    return <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />;
  }
  const list = byUrgency(courses.data.data);
  const due = list.filter((c) => c.state !== 'completed' && dueInfo(c) !== null && c.date_to !== null);

  return (
    <ScrollView
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {courses.data.fromCache ? <Notice message={savedCopyText(courses.data.fetchedAt)} /> : null}
      {list.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Nothing has been assigned to you in Lodestar yet."
        />
      ) : (
        <>
          <Card variant="flat" style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">
              My Stats
            </AppText>
            {list.map((c) => (
              <View key={c.id} style={styles.item}>
                <AppText style={styles.name}>{c.name}</AppText>
                <ProgressBar percent={c.percent} label={`${c.name} progress`} />
                <AppText variant="caption" muted>
                  {c.completed} of {c.total} items completed ({c.percent}%)
                </AppText>
              </View>
            ))}
          </Card>

          <Card variant="flat" style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">
              Due Dates
            </AppText>
            {due.length === 0 ? (
              <AppText muted>Nothing is due.</AppText>
            ) : (
              due.map((c) => {
                const d = dueInfo(c)!;
                return (
                  <View key={c.id} style={styles.item}>
                    <AppText style={styles.name}>{c.name}</AppText>
                    <AppText variant="caption" style={{ color: TONE[d.tone] }}>
                      {d.text} · due {c.date_to}
                    </AppText>
                  </View>
                );
              })
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  item: { gap: spacing.xs },
  name: { fontFamily: 'Nunito_700Bold' },
});
