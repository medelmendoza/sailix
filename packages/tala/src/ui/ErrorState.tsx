import { StyleSheet, View } from 'react-native';
import { spacing } from './theme';
import { GENERIC_ERROR_MESSAGE } from '../errors';
import { AppText } from './AppText';
import { Button } from './Button';

type Props = { message?: string; onRetry?: () => void };

/** Distinct from EmptyState: Flutter showed "No data found" for failures too. */
export function ErrorState({ message = GENERIC_ERROR_MESSAGE, onRetry }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <AppText style={styles.text}>{message}</AppText>
      {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg, padding: spacing.xxl },
  text: { textAlign: 'center' },
});
