import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/constants/theme';

/** A raised soft-UI card ("raised"), a pressed-in well ("inset"), or just a rounded container ("flat"). */
export function Card({
  children,
  style,
  variant = 'raised',
}: {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'raised' | 'inset' | 'flat';
}) {
  return (
    <View
      style={[
        styles.card,
        variant === 'raised' && { boxShadow: shadows.raised },
        variant === 'inset' && { boxShadow: shadows.inset },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
});
