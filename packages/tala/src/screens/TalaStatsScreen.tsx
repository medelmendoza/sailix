import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { TalaRoutes } from '../routes';
import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Notice,
  ProgressBar,
  SkeletonList,
} from '../ui';
import { colors, fonts, minTouchTarget, radius, spacing } from '../ui/theme';
import { describeError } from '../errors';
import { useTalaCourses } from '../data/api';
import { TalaCourseProgress } from './TalaCourseProgress';
import { savedCopyText } from './TalaCourseList';
import { byUrgency, dueInfo, overall } from './stats';
import { useBrand } from '../ui/brand';

/**
 * My Stats: how far the learner is, course by course, and what is due. Everything comes from Tala's own counters through the
 * gateway (read-only) and is available offline from the saved copy. It is computed by Tala/the gateway, not on the device.
 */
export function TalaStatsScreen() {
  const brand = useBrand();
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
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
          description="Nothing has been assigned to you in Lodestar yet."
        />
      ) : (
        <>
          <Card variant="flat" style={styles.overall}>
            <AppText variant="heading" accessibilityRole="header">
              Overall
            </AppText>
            <View style={styles.big}>
              <AppText
                style={[styles.bigNumber, { color: brand.primary }]}
                accessibilityElementsHidden
              >
                {o.percent}%
              </AppText>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <ProgressBar percent={o.percent} label="Overall progress" />
                <AppText>
                  {o.itemsDone} of {o.itemsTotal} items completed ({o.percent}%)
                </AppText>
              </View>
            </View>
            <View style={styles.tiles}>
              <Tile n={o.completed} label="completed" bg={colors.successBg} ink={colors.success} />
              <Tile n={o.inProgress} label="in progress" bg={brand.infoBg} ink={brand.primary} />
              <Tile
                n={o.notStarted}
                label="not started"
                bg={colors.surfaceSunken}
                ink={colors.textMuted}
              />
            </View>
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
              <Card variant="flat" style={styles.row}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText style={styles.courseName}>{c.name}</AppText>
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

function Tile({ n, label, bg, ink }: { n: number; label: string; bg: string; ink: string }) {
  return (
    <View
      style={[styles.tile, { backgroundColor: bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText style={[styles.tileNumber, { color: ink }]}>{n}</AppText>
      <AppText variant="caption" style={{ color: ink }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  overall: { gap: spacing.md, padding: spacing.lg },
  big: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bigNumber: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 48, color: colors.primary },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.md },
  tileNumber: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30 },
  courseName: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget, gap: spacing.md },
  pressed: { opacity: 0.7 },
});
