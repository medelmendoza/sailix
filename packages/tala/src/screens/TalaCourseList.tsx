import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { TalaRoutes } from '../routes';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  GlyphIcon,
  Notice,
  SearchField,
} from '../ui';
import { colors, minTouchTarget, radius, spacing } from '../ui/theme';
import { describeError } from '../errors';
import type { TalaCourse } from '../types';
import { useTalaCourses } from '../data/api';
import { TalaCourseCard } from './TalaCourseCard';
import { TalaCourseGridCard } from './TalaCourseGridCard';
import { CourseListSkeleton } from './TalaSkeletons';
import { useBrand } from '../ui/brand';

/** Courses shown at a time; "Show more" adds this many again. */
export const PAGE_SIZE = 10;

export function savedCopyText(fetchedAt: string | null): string {
  const when = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'earlier';
  return `You are viewing the copy saved on this device (${when}). It updates when you are back online.`;
}

type StateFilter = 'all' | TalaCourse['state'];
const FILTERS: readonly { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'not_started', label: 'Not started' },
  { value: 'completed', label: 'Finished' },
];

type CourseView = 'list' | 'grid';
const VIEW_KEY = 'sailix:tala:course-view';

/** The layout the learner picked for the course list, remembered on this device (never needed to work). */
function useCourseView(): [CourseView, (v: CourseView) => void] {
  const [view, setView] = useState<CourseView>('list');
  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY)
      .then((v) => {
        if (v === 'list' || v === 'grid') setView(v);
      })
      .catch(() => undefined);
  }, []);
  return [
    view,
    (v) => {
      setView(v);
      AsyncStorage.setItem(VIEW_KEY, v).catch(() => undefined);
    },
  ];
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
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const brand = useBrand();
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
  const courses = useTalaCourses();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [view, setView] = useCourseView();
  const [filter, setFilter] = useState<StateFilter>('all');

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
  const inFilter = filter === 'all' ? all : all.filter((c) => c.state === filter);
  const matches = needle === '' ? inFilter : inFilter.filter((c) => plain(c.name).includes(needle));
  const countOf = (f: StateFilter) =>
    f === 'all' ? all.length : all.filter((c) => c.state === f).length;
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
      <View style={styles.titleRow}>
        <AppText variant="heading">My courses</AppText>
        <View style={styles.toggle} accessibilityRole="radiogroup">
          {(['list', 'grid'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={v === 'list' ? 'List view' : 'Grid view'}
              accessibilityState={{ checked: view === v }}
              onPress={() => setView(v)}
              style={[styles.toggleButton, view === v && styles.toggleOn]}
            >
              <GlyphIcon name={v} size={20} color={view === v ? brand.primary : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
      {courses.isPending ? (
        <CourseListSkeleton grid={view === 'grid'} />
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                accessibilityRole="radiogroup"
              >
                {FILTERS.map((f) => {
                  const on = filter === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`${f.label}, ${countOf(f.value)}`}
                      accessibilityState={{ checked: on }}
                      onPress={() => {
                        setFilter(f.value);
                        setShown(PAGE_SIZE);
                      }}
                      style={[
                        styles.chip,
                        on && { backgroundColor: brand.primary, borderColor: brand.primary },
                      ]}
                    >
                      <AppText
                        variant="button"
                        style={{ color: on ? colors.onPrimary : colors.text }}
                      >
                        {f.label}
                      </AppText>
                      <AppText
                        variant="caption"
                        style={{ color: on ? colors.onPrimary : colors.textMuted }}
                      >
                        {countOf(f.value)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {matches.length === 0 ? (
                <EmptyState
                  title="No courses match"
                  description={
                    needle !== ''
                      ? `Nothing matches \u201c${query.trim()}\u201d.`
                      : 'There are no courses in this group yet.'
                  }
                />
              ) : view === 'grid' ? (
                <View style={styles.grid}>
                  {visible.map((c) => (
                    <TalaCourseGridCard
                      key={c.id}
                      course={c}
                      onPress={() =>
                        navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })
                      }
                    />
                  ))}
                </View>
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
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleButton: {
    width: minTouchTarget - 4,
    height: minTouchTarget - 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.surface },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  more: { gap: spacing.md, alignItems: 'stretch' },
});
