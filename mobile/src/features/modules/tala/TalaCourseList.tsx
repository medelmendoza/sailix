import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, EmptyState, ErrorState, Notice, SkeletonList } from '@/components';
import { minTouchTarget, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useTalaCourses } from './api';
import { TalaCourseCard } from './TalaCourseCard';

export function savedCopyText(fetchedAt: string | null): string {
  const when = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'earlier';
  return `You are viewing the copy saved on this device (${when}). It updates when you are back online.`;
}

export function TalaCourseList({
  header,
  footer,
}: {
  header: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const courses = useTalaCourses();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {header}
      <AppText variant="heading">My courses</AppText>
      {courses.isPending ? (
        <SkeletonList />
      ) : courses.isError ? (
        <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />
      ) : (
        <>
          {courses.data.fromCache ? (
            <Notice message={savedCopyText(courses.data.fetchedAt)} />
          ) : null}
          {courses.data.data.length === 0 ? (
            <EmptyState
              title="No courses assigned"
              description="Nothing has been assigned to you in Tala yet."
            />
          ) : (
            courses.data.data.map((c) => (
              <TalaCourseCard
                key={c.id}
                course={c}
                onPress={() => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })}
              />
            ))
          )}
        </>
      )}
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget, gap: spacing.md },
  pressed: { opacity: 0.7 },
});
