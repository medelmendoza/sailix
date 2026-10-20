import { StyleSheet, View } from 'react-native';
import { colors, gradients, radius, shadows } from '@/constants/theme';
import { useBrand } from '@/theme/brand';

/** Accessible progress bar: announced as a value, not just painted. */
export function ProgressBar({
  percent,
  label,
  color,
}: {
  percent: number;
  label: string;
  /** Overrides the brand colour (for example green/orange/red for how far a loan is paid). */
  color?: string;
}) {
  const brand = useBrand();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${value}%`,
            backgroundColor: brand.primary,
            experimental_backgroundImage: brand.gradients.primary,
          },
          color ? { backgroundColor: color, experimental_backgroundImage: undefined } : null,
        ]}
      />
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
