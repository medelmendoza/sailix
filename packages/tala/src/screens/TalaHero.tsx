import { StyleSheet, View } from 'react-native';
import { AppText, ShimmerBlock } from '../ui';
import { useBrand } from '../ui/brand';
import { LodestarLogo } from '../ui/LodestarLogo';
import { colors, spacing } from '../ui/theme';

/**
 * The banner at the top: a welcome with the learner's first name and the Lodestar logo, then how far they are overall, in a
 * few numbers, on the organization's gradient. `name` is undefined while it loads and null when it cannot be read.
 */
export function Hero({
  name,
  percent,
  done,
  total,
  courses,
  next,
}: {
  name: string | null | undefined;
  percent: number;
  done: number;
  total: number;
  courses: number;
  next: string | null;
}) {
  const brand = useBrand();
  return (
    <View
      key={brand.gradients.header} // the gradient is rebuilt, not changed, when the look changes
      style={[styles.hero, { backgroundColor: brand.primary, experimental_backgroundImage: brand.gradients.header }]}
    >
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.white}>Welcome,</AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.white} numberOfLines={1}>
            {name === undefined ? ' ' : (name ?? 'Lodestar')}
          </AppText>
        </View>
        <LodestarLogo size={60} />
      </View>
      <View style={styles.divider} />
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

/** The banner while the numbers load: the same shape and size; the welcome and the logo are fixed, so they are real. */
export function HeroSkeleton() {
  return (
    <View style={[styles.hero, { backgroundColor: colors.surfaceSunken }]}>
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText>Welcome,</AppText>
          <ShimmerBlock style={{ width: 160, height: 36, borderRadius: 8 }} />
        </View>
        <LodestarLogo size={60} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />
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
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  white: { color: '#FFFFFF' },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,255,255,0.3)' },
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
