import { StyleSheet, View } from 'react-native';
import { spacing } from './theme';
import { AppText } from './AppText';

type Props = { message?: string; title?: string; description?: string };

export function EmptyState({ message, title, description }: Props) {
  const body = description ?? message ?? (title ? undefined : 'No data found.');
  return (
    <View style={styles.wrap}>
      {title ? <AppText variant="heading">{title}</AppText> : null}
      {body ? (
        <AppText muted style={styles.text}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs, padding: spacing.xxl },
  text: { textAlign: 'center' },
});
