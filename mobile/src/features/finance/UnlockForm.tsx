import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BrandTextInput } from '@/components/BrandTextInput';
import { AppText, Button, Card, FormError, GlyphIcon } from '@/components';
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
  const [revealed, setRevealed] = useState(false);
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
        <View style={styles.box}>
          <BrandTextInput
            accessibilityLabel="Password"
            secureTextEntry={!revealed}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide Password' : 'Show Password'}
            onPress={() => setRevealed((v) => !v)}
            style={styles.toggle}
          >
            <GlyphIcon name={revealed ? 'eyeoff' : 'eye'} color={colors.border} size={26} />
          </Pressable>
        </View>
      </View>
      <Button title="Open payslips" loading={unlock.isPending} onPress={() => void submit()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
