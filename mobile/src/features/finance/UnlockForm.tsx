import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Card, FormError } from '@/components';
import { colors, fonts, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useUnlock } from './api';

/**
 * Your payslips are private: the server asks for your password again, every few minutes, on each sign-in. This replaces
 * the old birthdate check, which anyone holding the phone could pass and the server never saw.
 */
export function UnlockForm() {
  const unlock = useUnlock();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!password) return setError('Enter your password.');
    try {
      await unlock.mutateAsync(password);
      setPassword('');
    } catch (e) {
      setError(describeError(e));
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        Enter your password
      </AppText>
      <AppText muted>
        Your payslips are private. Enter the password you sign in with to open them.
      </AppText>
      <FormError message={error} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption">Password</AppText>
        <TextInput
          accessibilityLabel="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          style={styles.input}
        />
      </View>
      <Button title="Open payslips" loading={unlock.isPending} onPress={() => void submit()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
