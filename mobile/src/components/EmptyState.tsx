import { StyleSheet, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { AppText } from './AppText';

export function EmptyState({ message = 'No data found.' }: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <AppText muted>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: spacing.xxl },
});
