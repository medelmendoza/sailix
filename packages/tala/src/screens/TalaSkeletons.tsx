import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Card, ShimmerBlock } from '../ui';
import { Dashlet } from '../ui/Dashlet';
import { colors, radius, spacing } from '../ui/theme';
import { HeroSkeleton } from './TalaHero';

/** Loading placeholders drawn in the shape of the real thing, so nothing jumps when the content arrives. */
function Loading({ children }: { children: React.ReactNode }) {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
      style={styles.stack}
    >
      {children}
    </View>
  );
}

/** One course card: the picture, the title, a chip and the creator, then the progress bar. */
function CourseCardSkeleton() {
  return (
    <Card variant="flat" style={styles.card}>
      <ShimmerBlock style={styles.picture} />
      <View style={styles.body}>
        <ShimmerBlock style={[styles.line, { width: '72%', height: 22 }]} />
        <View style={styles.facts}>
          <ShimmerBlock style={[styles.pill, { width: 124 }]} />
          <ShimmerBlock style={[styles.line, { width: 96, height: 14 }]} />
        </View>
        <ShimmerBlock style={styles.bar} />
        <ShimmerBlock style={[styles.line, { width: '48%', height: 12 }]} />
      </View>
    </Card>
  );
}

/** One course tile of the two-column view. */
function CourseTileSkeleton() {
  return (
    <Card variant="flat" style={styles.tileCard}>
      <ShimmerBlock style={styles.tilePicture} />
      <View style={styles.tileBody}>
        <ShimmerBlock style={[styles.line, { width: '85%', height: 16 }]} />
        <ShimmerBlock style={[styles.line, { width: '60%', height: 16 }]} />
        <ShimmerBlock style={styles.bar} />
        <ShimmerBlock style={[styles.line, { width: '50%', height: 12 }]} />
      </View>
    </Card>
  );
}

export function CourseListSkeleton({
  count = 3,
  grid = false,
}: {
  count?: number;
  grid?: boolean;
}) {
  if (grid) {
    return (
      <Loading>
        <View style={styles.tileGrid}>
          {Array.from({ length: 4 }, (_, i) => (
            <CourseTileSkeleton key={i} />
          ))}
        </View>
      </Loading>
    );
  }
  return (
    <Loading>
      {Array.from({ length: count }, (_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </Loading>
  );
}

/** The course page: the big picture, the info card, the description, and a few material cards. */
export function CourseDetailSkeleton() {
  return (
    <Loading>
      <ShimmerBlock style={styles.hero} />
      <View style={styles.summaryWrap}>
        <Card variant="flat" style={styles.info}>
          <ShimmerBlock style={[styles.pill, { width: 150 }]} />
          <ShimmerBlock style={[styles.line, { width: '60%', height: 24 }]} />
          <ShimmerBlock style={[styles.line, { width: '45%', height: 36 }]} />
          <ShimmerBlock style={styles.bar} />
          <View style={styles.facts}>
            {[0, 1, 2].map((i) => (
              <ShimmerBlock key={i} style={[styles.tile, { flex: 1 }]} />
            ))}
          </View>
        </Card>
      </View>
      <View style={styles.page}>
        <Card variant="flat" style={styles.info}>
          <ShimmerBlock style={[styles.line, { width: '45%', height: 20 }]} />
          <ShimmerBlock style={[styles.line, { width: '90%', height: 14 }]} />
        </Card>
        {[0, 1, 2].map((i) => (
          <Card key={i} variant="flat" style={styles.info}>
            <View style={styles.materialHead}>
              <ShimmerBlock style={styles.badge} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <ShimmerBlock style={[styles.line, { width: '30%', height: 12 }]} />
                <ShimmerBlock style={[styles.line, { width: '80%', height: 18 }]} />
                <ShimmerBlock style={[styles.pill, { width: 96 }]} />
              </View>
            </View>
            <ShimmerBlock style={[styles.pill, { height: 48, width: '100%' }]} />
          </Card>
        ))}
      </View>
    </Loading>
  );
}

/** A ring (donut) placeholder: a shimmering disc with the hole cut out, the size of the real chart. */
function RingSkeleton({ size = 176, thickness = 18 }: { size?: number; thickness?: number }) {
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <ShimmerBlock style={{ width: size, height: size, borderRadius: size / 2 }} />
      <View
        style={{
          position: 'absolute',
          left: thickness,
          top: thickness,
          width: size - 2 * thickness,
          height: size - 2 * thickness,
          borderRadius: (size - 2 * thickness) / 2,
          backgroundColor: colors.surface,
        }}
      />
    </View>
  );
}

const LegendSkeleton = ({ widths }: { widths: number[] }) => (
  <View style={styles.legend}>
    {widths.map((w, i) => (
      <ShimmerBlock key={i} style={[styles.pill, { width: w, height: 18 }]} />
    ))}
  </View>
);

/**
 * The dashboard while it loads: the banner and the same tiles (their icon, title and hint are fixed text, so they are real),
 * with shimmer where each chart will be.
 */
export function DashboardSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.dash}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      <HeroSkeleton />
      <Dashlet title="Courses by state" subtitle="Tap a part to see the courses" icon="grid">
        <RingSkeleton />
        <LegendSkeleton widths={[104, 116, 116]} />
      </Dashlet>
      <Dashlet title="Progress by course" subtitle="Tap a course to open it" icon="chart">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ gap: spacing.xs }}>
            <ShimmerBlock style={[styles.line, { width: `${72 - i * 8}%`, height: 14 }]} />
            <ShimmerBlock style={styles.slim} />
          </View>
        ))}
      </Dashlet>
      <Dashlet title="Items still to do" subtitle="Where the remaining work is" icon="list">
        <RingSkeleton thickness={22} />
        <LegendSkeleton widths={[150, 140, 130, 120]} />
      </Dashlet>
      <Dashlet title="Due in the coming weeks" subtitle="Tap a week to see its courses" icon="clock">
        <ShimmerBlock style={{ height: 170, borderRadius: radius.md }} />
        <View style={styles.axis}>
          {[0, 1, 2, 3].map((i) => (
            <ShimmerBlock key={i} style={[styles.line, { width: 44, height: 12 }]} />
          ))}
        </View>
      </Dashlet>
    </ScrollView>
  );
}

/** My Stats while it loads: the Overall card (its heading is fixed text) and the course rows. */
export function StatsSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.dash}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      <Card variant="flat" style={styles.info}>
        <AppText variant="heading">Overall</AppText>
        <View style={styles.facts}>
          <ShimmerBlock style={{ width: 84, height: 48, borderRadius: radius.md }} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <ShimmerBlock style={styles.slim} />
            <ShimmerBlock style={[styles.line, { width: '60%', height: 14 }]} />
          </View>
        </View>
        <View style={styles.facts}>
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} style={[styles.tile, { flex: 1 }]} />
          ))}
        </View>
      </Card>
      <AppText variant="heading">Courses</AppText>
      <CourseRowsSkeleton count={4} />
    </ScrollView>
  );
}

/** Rows that show a course: its name, a progress bar and a line under it. */
function CourseRowsSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} variant="flat" style={styles.rowCard}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <ShimmerBlock style={[styles.line, { width: '70%', height: 20 }]} />
            <ShimmerBlock style={styles.slim} />
            <ShimmerBlock style={[styles.line, { width: '55%', height: 12 }]} />
          </View>
        </Card>
      ))}
    </>
  );
}

/** The list of courses behind a number on the dashboard. */
export function DrillSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.drill}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      <CourseRowsSkeleton count={4} />
    </ScrollView>
  );
}

/** The record of one course: its summary card, the "Items" heading (fixed text) and a card per item. */
export function CourseStatsSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={styles.drill}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      <Card variant="flat" style={styles.info}>
        <ShimmerBlock style={[styles.line, { width: '65%', height: 24 }]} />
        <ShimmerBlock style={[styles.line, { width: '40%', height: 14 }]} />
        <ShimmerBlock style={styles.slim} />
        <ShimmerBlock style={[styles.line, { width: '55%', height: 12 }]} />
      </Card>
      <AppText variant="heading">Items</AppText>
      {[0, 1, 2].map((i) => (
        <Card key={i} variant="flat" style={styles.info}>
          <ShimmerBlock style={[styles.line, { width: '60%', height: 18 }]} />
          <ShimmerBlock style={[styles.line, { width: '35%', height: 12 }]} />
          <ShimmerBlock style={[styles.line, { width: '70%', height: 12 }]} />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  dash: { padding: spacing.lg, gap: spacing.lg },
  drill: { padding: spacing.lg, gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  slim: { height: 12, borderRadius: 6, width: '100%' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { padding: 0, borderRadius: radius.lg, overflow: 'hidden' },
  picture: { height: 150, width: '100%' },
  body: { padding: spacing.lg, gap: spacing.md },
  facts: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  tileCard: { width: '48.5%', padding: 0, borderRadius: radius.lg, overflow: 'hidden' },
  tilePicture: { height: 104, width: '100%' },
  tileBody: { padding: spacing.md, gap: spacing.sm },
  line: { borderRadius: radius.sm },
  pill: { height: 24, borderRadius: radius.pill },
  bar: { height: 12, borderRadius: radius.pill, width: '100%' },
  hero: {
    height: 230,
    width: '100%',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  summaryWrap: { marginTop: -56, paddingHorizontal: spacing.lg },
  tile: { height: 64, borderRadius: radius.md },
  page: { padding: spacing.lg, gap: spacing.lg },
  info: { gap: spacing.md, padding: spacing.lg },
  materialHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  badge: { width: 60, height: 60, borderRadius: radius.md },
});
