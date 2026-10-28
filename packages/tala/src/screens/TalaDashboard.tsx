import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTalaCourses, useTalaProfile } from '../data/api';
import { describeError } from '../errors';
import type { TalaRoutes } from '../routes';
import type { TalaCourse } from '../types';
import { AppText, EmptyState, ErrorState, Notice } from '../ui';
import { Dashlet } from '../ui/Dashlet';
import { Hero } from './TalaHero';
import { DashboardSkeleton } from './TalaSkeletons';
import { useBrand } from '../ui/brand';
import { BarRows, Donut, Legend, LineChart, type Segment } from '../ui/charts';
import { onTabScroll } from '../ui/tabBarCollapse';
import { colors, spacing } from '../ui/theme';
import { savedCopyText } from './TalaCourseList';
import { byUrgency, dueInfo, overall, parseDay } from './stats';

const WEEKS = 12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysFromToday(day: string | null, today: Date): number | null {
  const d = parseDay(day);
  if (!d) return null;
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Unfinished courses due in each of the next WEEKS weeks, and how many fall before or after that window. */
export function dueByWeek(courses: readonly TalaCourse[], today: Date = new Date()) {
  const ids: string[][] = Array.from({ length: WEEKS }, () => []);
  const overdue: string[] = [];
  const later: string[] = [];
  let dated = 0;
  for (const c of courses) {
    if (c.state === 'completed') continue;
    const left = daysFromToday(c.date_to, today);
    if (left === null) continue;
    dated++;
    if (left < 0) overdue.push(c.id);
    else if (left >= WEEKS * 7) later.push(c.id);
    else ids[Math.floor(left / 7)]!.push(c.id);
  }
  const counts = ids.map((i) => i.length);
  const starts = counts.map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i * 7);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  });
  const labels = starts.map((l, i) => (i % 3 === 0 ? l : ''));
  return { counts, ids, starts, labels, overdue, later, dated };
}

/**
 * The home tab of the Tala app: charts of how the learner is doing, from Tala's own counters (so it also works offline from
 * the saved copy). Read-only: it opens nothing; courses are opened from My Courses.
 */
export function TalaDashboard() {
  const brand = useBrand();
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
  const courses = useTalaCourses();
  const profile = useTalaProfile();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  if (courses.isPending) return <DashboardSkeleton />;
  if (courses.isError) {
    return <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />;
  }
  const list = byUrgency(courses.data.data);
  const o = overall(list);

  const nextCourse = list.find((c) => c.state !== 'completed' && dueInfo(c) !== null && c.date_to !== null);
  const nextDue = nextCourse ? (dueInfo(nextCourse)?.text ?? null) : null;
  const drill = (title: string, ids: string[]) => () => navigation.navigate('TalaDrill', { title, ids });
  const idsOf = (state: TalaCourse['state']) => list.filter((c) => c.state === state).map((c) => c.id);
  const states: Segment[] = [
    { value: o.completed, color: colors.success, label: `Completed ${o.completed}`, onPress: drill('Completed', idsOf('completed')) },
    { value: o.inProgress, color: brand.primary, label: `In progress ${o.inProgress}`, onPress: drill('In progress', idsOf('in_progress')) },
    { value: o.notStarted, color: colors.border, label: `Not started ${o.notStarted}`, onPress: drill('Not started', idsOf('not_started')) },
  ];

  // where the work is: items still to do per course, the biggest five and the rest together
  const left = list
    .map((c) => ({ id: c.id, name: c.name, left: Math.max(0, c.total - Math.min(c.completed, c.total)) }))
    .filter((c) => c.left > 0)
    .sort((a, b) => b.left - a.left);
  const palette = [brand.primary, colors.seafoam, colors.gold, colors.coral, colors.info];
  const top = left.slice(0, 5);
  const rest = left.slice(5).reduce((n, c) => n + c.left, 0);
  const pie: Segment[] = [
    ...top.map((c, i) => ({
      value: c.left,
      color: palette[i]!,
      label: `${c.name} ${c.left}`,
      onPress: () => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name }),
    })),
    ...(rest > 0
      ? [{ value: rest, color: colors.border, label: `Other ${rest}`, onPress: drill('Other courses', left.slice(5).map((c) => c.id)) }]
      : []),
  ];

  const weeks = dueByWeek(list);

  return (
    <ScrollView
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {courses.data.fromCache ? <Notice message={savedCopyText(courses.data.fetchedAt)} /> : null}
      {list.length === 0 ? (
        <EmptyState title="No courses yet" description="Nothing has been assigned to you in Lodestar yet." />
      ) : (
        <>
          <Hero name={profile.isPending ? undefined : (profile.data?.firstName ?? null)} percent={o.percent} done={o.itemsDone} total={o.itemsTotal} courses={o.courses} next={nextDue} />

          <Dashlet title="Courses by state" subtitle="Tap a part to see the courses" icon="grid">
            <View style={styles.center}>
              <Donut
                segments={states}
                size={176}
                summary={`Courses by state: ${o.completed} completed, ${o.inProgress} in progress, ${o.notStarted} not started`}
              >
                <AppText style={[styles.big, { color: brand.primary }]}>{o.courses}</AppText>
                <AppText variant="caption" muted>
                  course{o.courses === 1 ? '' : 's'}
                </AppText>
              </Donut>
            </View>
            <Legend items={states} />
          </Dashlet>

          <Dashlet title="Progress by course" subtitle="Tap a course to open it" icon="chart">
            <BarRows
              rows={list.map((c) => ({
                label: c.name,
                value: c.percent,
                text: `${c.percent}%`,
                color: c.percent >= 100 ? colors.success : undefined,
                onPress: () => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name }),
              }))}
              max={100}
              color={brand.primary}
            />
          </Dashlet>

          <Dashlet title="Items still to do" subtitle="Where the remaining work is" icon="list">
            {pie.length === 0 ? (
              <AppText muted>Everything is done.</AppText>
            ) : (
              <>
                <View style={styles.center}>
                  <Donut
                    segments={pie}
                    thickness={22}
                    rounded={false}
                    size={176}
                    summary={`Items still to do: ${pie.map((s) => s.label).join(', ')}`}
                  >
                    <AppText style={[styles.big, { color: brand.primary }]}>{left.reduce((n, c) => n + c.left, 0)}</AppText>
                    <AppText variant="caption" muted>
                      to do
                    </AppText>
                  </Donut>
                </View>
                <Legend items={pie} />
              </>
            )}
          </Dashlet>

          {weeks.dated > 0 ? (
            <Dashlet title="Due in the coming weeks" subtitle="Tap a week to see its courses" icon="clock">
              <LineChart
                values={weeks.counts}
                labels={weeks.labels}
                color={brand.primary}
                height={170}
                columns={weeks.ids.map((ids, i) =>
                  ids.length > 0
                    ? {
                        label: `Due week of ${weeks.starts[i]}: ${ids.length} course${ids.length === 1 ? '' : 's'}`,
                        onPress: drill(`Due week of ${weeks.starts[i]}`, ids),
                      }
                    : null,
                )}
                summary={`Courses due per week, next ${WEEKS} weeks: ${weeks.counts.join(', ')}${
                  weeks.overdue.length ? `; ${weeks.overdue.length} overdue` : ''
                }${weeks.later.length ? `; ${weeks.later.length} later` : ''}`}
              />
              <Legend
                items={[
                  { color: brand.primary, label: 'Courses due each week' },
                  ...(weeks.overdue.length
                    ? [{ color: colors.danger, label: `${weeks.overdue.length} overdue`, onPress: drill('Overdue', weeks.overdue) }]
                    : []),
                  ...(weeks.later.length
                    ? [{ color: colors.border, label: `${weeks.later.length} later`, onPress: drill('Due later', weeks.later) }]
                    : []),
                ]}
              />
            </Dashlet>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  center: { alignItems: 'center' },
  big: { fontFamily: 'Quicksand_700Bold', fontSize: 32, lineHeight: 38 },
});
