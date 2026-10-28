import { StyleSheet, View } from 'react-native';
import { radius, spacing } from './theme';
import { ShimmerBlock } from './Shimmer';

/** Generic loading placeholder: rows with a sweeping shimmer. Hidden from screen readers; the parent announces loading. */
export function SkeletonList({ count = 6, height = 80 }: { count?: number; height?: number }) {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBlock key={i} style={[styles.row, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: radius.lg, marginBottom: spacing.md },
});
