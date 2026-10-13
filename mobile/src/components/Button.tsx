import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { AppText } from './AppText';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  accessibilityLabel,
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
        (pressed || inactive) && styles.dim,
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
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  dim: { opacity: 0.6 },
});
