import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Notice,
  ProgressBar,
  SkeletonList,
} from '@/components';
import { minTouchTarget, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useTalaCourses } from './api';
import { TalaCourseProgress } from './TalaCourseProgress';
import { savedCopyText } from './TalaCourseList';
import { byUrgency, dueInfo, overall } from './stats';

/**
 * My Stats: how far the learner is, course by course, and what is due. Everything comes from Tala's own counters through the
 * gateway (read-only) and is available offline from the saved copy. It is computed by Tala/the gateway, not on the device.
 */
export function TalaStatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const courses = useTalaCourses();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  if (courses.isPending) return <SkeletonList />;
  if (courses.isError) {
    return (
      <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />
    );
  }
  const list = courses.data.data;
  const o = overall(list);
  const next = byUrgency(list).find((c) => c.state !== 'completed' && dueInfo(c) !== null);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {courses.data.fromCache ? <Notice message={savedCopyText(courses.data.fetchedAt)} /> : null}
      {list.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Nothing has been assigned to you in Tala yet."
        />
      ) : (
        <>
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading" accessibilityRole="header">
              Overall
            </AppText>
            <ProgressBar percent={o.percent} label="Overall progress" />
            <AppText>
              {o.itemsDone} of {o.itemsTotal} items completed ({o.percent}%)
            </AppText>
            <AppText variant="caption" muted>
              {o.completed} completed · {o.inProgress} in progress · {o.notStarted} not started
            </AppText>
            {next ? (
              <AppText variant="caption" muted>
                Next due: {next.name} · {dueInfo(next)?.text}
              </AppText>
            ) : null}
          </Card>

          <AppText variant="heading">Courses</AppText>
          {byUrgency(list).map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${c.completed} of ${c.total} items completed`}
              onPress={() => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}
            >
              <Card style={styles.row}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="heading">{c.name}</AppText>
                  <TalaCourseProgress course={c} />
                </View>
                <AppText muted>›</AppText>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget, gap: spacing.md },
  pressed: { opacity: 0.7 },
});
