import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

/** One sweep shared by every placeholder on screen, so they all shimmer in step; it runs only while some are showing. */
const sweep = new Animated.Value(0);
let showing = 0;
let loop: Animated.CompositeAnimation | null = null;

function useSweep() {
  useEffect(() => {
    showing += 1;
    if (showing === 1) {
      loop = Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      );
      loop.start();
    }
    return () => {
      showing -= 1;
      if (showing === 0) {
        loop?.stop();
        loop = null;
        sweep.setValue(0);
      }
    };
  }, []);
}

/** A grey placeholder shape with a light band sweeping across it. Decorative: the parent announces that it is loading. */
export function ShimmerBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  useSweep();
  const [width, setWidth] = useState(0);
  const band = Math.max(60, width * 0.55);
  const x = sweep.interpolate({ inputRange: [0, 1], outputRange: [-band, width] });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.block, style]}
    >
      <Animated.View style={[styles.band, { width: band, transform: [{ translateX: x }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.skeleton, overflow: 'hidden' },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
  },
});
