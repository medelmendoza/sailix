import { StyleSheet, View } from 'react-native';
import { colors, gradients, radius, shadows } from '@/constants/theme';

/** Accessible progress bar: announced as a value, not just painted. */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${value}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    boxShadow: shadows.insetSm,
    overflow: 'hidden',
  },
  fill: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.primary,
  },
});
