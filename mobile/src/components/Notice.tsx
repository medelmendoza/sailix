import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

type Tone = 'info' | 'success' | 'warning';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: '#E7EFF9', fg: colors.primary },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
};

export function Notice({ message, tone = 'info' }: { message: string; tone?: Tone }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: TONES[tone].bg }]}
    >
      <AppText variant="caption" style={{ color: TONES[tone].fg }}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ box: { borderRadius: radius.sm, padding: spacing.md } });
