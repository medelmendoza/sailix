import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

/** Loading placeholder list (replaces Flutter's shimmer). Hidden from screen readers; the parent announces loading. */
export function SkeletonList({ count = 6, height = 80 }: { count?: number; height?: number }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
    >
      {Array.from({ length: count }, (_, i) => (
        <Animated.View key={i} style={[styles.row, { height, opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.skeleton, borderRadius: radius.lg, marginBottom: spacing.md },
});
