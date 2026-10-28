import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';

export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={[styles.body, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  padded: { padding: spacing.lg },
});
