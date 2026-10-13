import { Pressable, StyleSheet } from 'react-native';
import { colors, minTouchTarget } from '@/constants/theme';
import { AppText } from './AppText';

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.base}
    >
      <AppText variant="button" style={{ color: colors.accent }}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
