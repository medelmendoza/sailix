import { StyleSheet, View } from 'react-native';
import { colors, gradients, radius, shadows, typography } from '@/constants/theme';
import { AppText } from './AppText';

/** The Sailix badge: a raised rounded square in the brand gradient. Decorative (the screen title carries the meaning). */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { width: size, height: size, borderRadius: radius.md }]}
    >
      <AppText
        style={[
          typography.title,
          { color: colors.onPrimary, fontSize: size * 0.5, lineHeight: size * 0.62 },
        ]}
      >
        S
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.primary,
    boxShadow: shadows.raisedSm,
  },
});
