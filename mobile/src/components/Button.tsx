import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import {
  colors,
  gradients,
  minTouchTarget,
  radius,
  shadows,
  spacing,
  typography,
} from '@/constants/theme';
import { AppText } from './AppText';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
  /** Layout only (e.g. `{ flex: 1 }` to share a row); the look comes from `variant`. */
  style?: ViewStyle;
};

/**
 * Soft-UI buttons. Primary: dusty-blue gradient, raised; secondary: the surface colour, raised. Pressing sinks the button
 * into the surface (inset), the way a real soft button gives way. Text colours meet WCAG AA on their fills.
 */
export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  accessibilityLabel,
  style,
}: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        { boxShadow: pressed ? shadows.insetSm : shadows.raisedSm },
        inactive && styles.dim,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.primary} />
      ) : (
        <AppText
          style={[typography.button, { color: primary ? colors.onPrimary : colors.primary }]}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary, experimental_backgroundImage: gradients.primary },
  secondary: { backgroundColor: colors.surface },
  dim: { opacity: 0.55 },
});
