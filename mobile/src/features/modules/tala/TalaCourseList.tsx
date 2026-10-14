import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, EmptyState, ErrorState, Notice, SearchField } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useTalaCourses } from './api';
import { TalaCourseCard } from './TalaCourseCard';
import { CourseListSkeleton } from './TalaSkeletons';

/** Courses shown at a time; "Show more" adds this many again. */
export const PAGE_SIZE = 10;

export function savedCopyText(fetchedAt: string | null): string {
  const when = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'earlier';
  return `You are viewing the copy saved on this device (${when}). It updates when you are back online.`;
}

/** Lower case without accents, so "navigacion" finds "Navigación". */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  function search(text: string) {
    setQuery(text);
    setShown(PAGE_SIZE); // a new search starts from its first page
  }

  const all = courses.data?.data ?? [];
  const needle = plain(query.trim());
  const matches = needle === '' ? all : all.filter((c) => plain(c.name).includes(needle));
  const visible = matches.slice(0, shown);
  const left = matches.length - visible.length;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {header}
      <AppText variant="heading">My courses</AppText>
      {courses.isPending ? (
        <CourseListSkeleton />
      ) : courses.isError ? (
        <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />
      ) : (
        <>
          {courses.data.fromCache ? (
            <Notice message={savedCopyText(courses.data.fetchedAt)} />
          ) : null}
          {all.length === 0 ? (
            <EmptyState
              title="No courses assigned"
              description="Nothing has been assigned to you in Tala yet."
            />
          ) : (
            <>
              <SearchField
                value={query}
                onChangeText={search}
                label="Search courses"
                placeholder="Search courses"
              />
              {matches.length === 0 ? (
                <EmptyState
                  title="No courses match"
                  description={`Nothing matches \u201c${query.trim()}\u201d.`}
                />
              ) : (
                visible.map((c) => (
                  <TalaCourseCard
                    key={c.id}
                    course={c}
                    onPress={() =>
                      navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })
                    }
                  />
                ))
              )}
              {matches.length > PAGE_SIZE ? (
                <View style={styles.more}>
                  <AppText variant="caption" muted>
                    Showing {visible.length} of {matches.length} courses
                  </AppText>
                  {left > 0 ? (
                    <Button
                      title="Show more"
                      variant="secondary"
                      accessibilityLabel={`Show more courses, ${left} left`}
                      onPress={() => setShown((n) => n + PAGE_SIZE)}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </>
      )}
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  more: { gap: spacing.md, alignItems: 'stretch' },
});
