import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from './theme';
import { AppText } from './AppText';

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <AppText variant="caption" style={{ color: colors.danger }}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: spacing.lg },
});
