import { StyleSheet, View } from 'react-native';
import { AppText, ShimmerBlock } from '../ui';
import { useBrand } from '../ui/brand';
import { colors, spacing } from '../ui/theme';

/** The banner at the top: how far the learner is overall, in a few numbers, on the organization's gradient. */
export function Hero({ percent, done, total, courses, next }: { percent: number; done: number; total: number; courses: number; next: string | null }) {
  const brand = useBrand();
  return (
    <View
      key={brand.gradients.header} // the gradient is rebuilt, not changed, when the look changes
      style={[styles.hero, { backgroundColor: brand.primary, experimental_backgroundImage: brand.gradients.header }]}
    >
      <AppText variant="caption" style={styles.heroLabel}>
        Your progress
      </AppText>
      <View style={styles.heroRow}>
        <AppText style={styles.heroPercent}>{percent}%</AppText>
        <AppText style={styles.heroSub}>
          {done} of {total} items completed
        </AppText>
      </View>
      <View style={styles.heroTrack}>
        <View style={[styles.heroFill, { width: `${Math.min(100, Math.max(0, percent))}%` }]} />
      </View>
      <View style={styles.heroChips}>
        <View style={styles.heroChip}>
          <AppText style={styles.heroChipText}>{courses} course{courses === 1 ? '' : 's'}</AppText>
        </View>
        {next ? (
          <View style={styles.heroChip}>
            <AppText style={styles.heroChipText}>Next due: {next}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The banner while the numbers load: the same shape and size, with shimmer where the numbers will be. */
export function HeroSkeleton() {
  return (
    <View style={[styles.hero, { backgroundColor: colors.surfaceSunken }]}>
      <ShimmerBlock style={{ width: 110, height: 18, borderRadius: 6 }} />
      <View style={styles.heroRow}>
        <ShimmerBlock style={{ width: 120, height: 50, borderRadius: 10 }} />
        <ShimmerBlock style={{ flex: 1, height: 18, borderRadius: 6 }} />
      </View>
      <ShimmerBlock style={{ height: 8, borderRadius: 4 }} />
      <View style={styles.heroChips}>
        <ShimmerBlock style={{ width: 96, height: 26, borderRadius: 999 }} />
        <ShimmerBlock style={{ width: 150, height: 26, borderRadius: 999 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: spacing.xl, gap: spacing.md },
  heroLabel: { color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  heroPercent: { color: '#FFFFFF', fontFamily: 'Quicksand_700Bold', fontSize: 44, lineHeight: 50 },
  heroSub: { color: '#FFFFFF', flex: 1 },
  heroTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  heroChipText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18 },
});
