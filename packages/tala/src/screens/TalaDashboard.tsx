import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTalaCourses } from '../data/api';
import { describeError } from '../errors';
import type { TalaCourse } from '../types';
import { AppText, Card, EmptyState, ErrorState, Notice, SkeletonList } from '../ui';
import { useBrand } from '../ui/brand';
import { BarRows, Donut, Legend, LineChart, type Segment } from '../ui/charts';
import { onTabScroll } from '../ui/tabBarCollapse';
import { colors, spacing } from '../ui/theme';
import { savedCopyText } from './TalaCourseList';
import { byUrgency, dueInfo, overall, parseDay, type Due } from './stats';

const TONE: Record<Due['tone'], string> = {
  done: colors.success,
  overdue: colors.danger,
  soon: colors.warning,
  ok: colors.textMuted,
  upcoming: colors.textMuted,
};

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
  const counts = Array<number>(WEEKS).fill(0);
  let overdue = 0;
  let later = 0;
  let dated = 0;
  for (const c of courses) {
    if (c.state === 'completed') continue;
    const left = daysFromToday(c.date_to, today);
    if (left === null) continue;
    dated++;
    if (left < 0) overdue++;
    else if (left >= WEEKS * 7) later++;
    else counts[Math.floor(left / 7)]!++;
  }
  const labels = counts.map((_, i) => {
    if (i % 3 !== 0) return '';
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i * 7);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  });
  return { counts, labels, overdue, later, dated };
}

/**
 * The home tab of the Tala app: charts of how the learner is doing, from Tala's own counters (so it also works offline from
 * the saved copy). Read-only: it opens nothing; courses are opened from My Courses.
 */
export function TalaDashboard() {
  const brand = useBrand();
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
  const o = overall(list);

  const states: Segment[] = [
    { value: o.completed, color: colors.success, label: `Completed ${o.completed}` },
    { value: o.inProgress, color: brand.primary, label: `In progress ${o.inProgress}` },
    { value: o.notStarted, color: colors.border, label: `Not started ${o.notStarted}` },
  ];

  // where the work is: items still to do per course, the biggest five and the rest together
  const left = list
    .map((c) => ({ name: c.name, left: Math.max(0, c.total - Math.min(c.completed, c.total)) }))
    .filter((c) => c.left > 0)
    .sort((a, b) => b.left - a.left);
  const palette = [brand.primary, colors.seafoam, colors.gold, colors.coral, colors.info];
  const top = left.slice(0, 5);
  const rest = left.slice(5).reduce((n, c) => n + c.left, 0);
  const pie: Segment[] = [
    ...top.map((c, i) => ({ value: c.left, color: palette[i]!, label: `${c.name} ${c.left}` })),
    ...(rest > 0 ? [{ value: rest, color: colors.border, label: `Other ${rest}` }] : []),
  ];

  const bars = list.slice(0, 8);
  const weeks = dueByWeek(list);
  const due = list.filter((c) => c.state !== 'completed' && dueInfo(c) !== null && c.date_to !== null).slice(0, 5);

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
          <Card variant="flat" style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">
              Overall
            </AppText>
            <View style={styles.center}>
              <Donut
                segments={states}
                summary={`Courses by state: ${o.completed} completed, ${o.inProgress} in progress, ${o.notStarted} not started`}
              >
                <AppText style={[styles.big, { color: brand.primary }]}>{o.percent}%</AppText>
                <AppText variant="caption" muted>
                  done
                </AppText>
              </Donut>
            </View>
            <Legend items={states.map((s) => ({ color: s.color, label: s.label }))} />
            <AppText variant="caption" muted>
              {o.itemsDone} of {o.itemsTotal} items completed
            </AppText>
          </Card>

          <Card variant="flat" style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">
              Progress by course
            </AppText>
            <BarRows
              rows={bars.map((c) => ({ label: c.name, value: c.percent, text: `${c.percent}%` }))}
              max={100}
              color={brand.primary}
              summary={`Progress by course: ${bars.map((c) => `${c.name} ${c.percent}%`).join(', ')}`}
            />
            {list.length > bars.length ? (
              <AppText variant="caption" muted>
                Showing {bars.length} of {list.length} courses; the Stats tab has them all.
              </AppText>
            ) : null}
          </Card>

          <Card variant="flat" style={styles.card}>
            <AppText variant="heading" accessibilityRole="header">
              Items still to do
            </AppText>
            {pie.length === 0 ? (
              <AppText muted>Everything is done.</AppText>
            ) : (
              <>
                <View style={styles.center}>
                  <Donut
                    segments={pie}
                    thickness={80}
                    size={160}
                    summary={`Items still to do: ${pie.map((s) => s.label).join(', ')}`}
                  />
                </View>
                <Legend items={pie.map((s) => ({ color: s.color, label: s.label }))} />
              </>
            )}
          </Card>

          {weeks.dated > 0 ? (
            <Card variant="flat" style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">
                Due in the coming weeks
              </AppText>
              <LineChart
                values={weeks.counts}
                labels={weeks.labels}
                color={brand.primary}
                summary={`Courses due per week, next ${WEEKS} weeks: ${weeks.counts.join(', ')}${
                  weeks.overdue ? `; ${weeks.overdue} overdue` : ''
                }${weeks.later ? `; ${weeks.later} later` : ''}`}
              />
              <AppText variant="caption" muted>
                Courses due each week
                {weeks.overdue ? ` · ${weeks.overdue} overdue` : ''}
                {weeks.later ? ` · ${weeks.later} later` : ''}
              </AppText>
            </Card>
          ) : null}

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
                  <View key={c.id} style={{ gap: spacing.xs }}>
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
  center: { alignItems: 'center' },
  big: { fontFamily: 'Quicksand_700Bold', fontSize: 32, lineHeight: 38 },
  name: { fontFamily: 'Nunito_700Bold' },
});
