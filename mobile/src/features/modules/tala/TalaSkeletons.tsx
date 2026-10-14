import { StyleSheet, View } from 'react-native';
import { Card, ShimmerBlock } from '@/components';
import { radius, spacing } from '@/constants/theme';

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

export function CourseListSkeleton({ count = 3 }: { count?: number }) {
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
      <View style={styles.page}>
        <Card variant="flat" style={styles.info}>
          <ShimmerBlock style={[styles.line, { width: '60%', height: 24 }]} />
          <ShimmerBlock style={[styles.line, { width: '40%', height: 14 }]} />
          <ShimmerBlock style={[styles.line, { width: '55%', height: 14 }]} />
          <ShimmerBlock style={styles.bar} />
        </Card>
        <Card variant="flat" style={styles.info}>
          <ShimmerBlock style={[styles.line, { width: '35%', height: 20 }]} />
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

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  card: { padding: 0, borderRadius: radius.lg, overflow: 'hidden' },
  picture: { height: 150, width: '100%' },
  body: { padding: spacing.lg, gap: spacing.md },
  facts: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { borderRadius: radius.sm },
  pill: { height: 24, borderRadius: radius.pill },
  bar: { height: 12, borderRadius: radius.pill, width: '100%' },
  hero: { height: 260, width: '100%' },
  page: { padding: spacing.lg, gap: spacing.lg },
  info: { gap: spacing.md, padding: spacing.lg },
  materialHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  badge: { width: 60, height: 60, borderRadius: radius.md },
});
