import { Pressable, StyleSheet } from 'react-native';
import { minTouchTarget } from '@/constants/theme';
import { AppText } from './AppText';
import { useBrand } from '@/theme/brand';

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const brand = useBrand();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.base}
    >
      <AppText variant="button" style={{ color: brand.accent }}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
