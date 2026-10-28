import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { AppText, Button, Card, FormError, FormScreen, Notice, TextField } from '../ui';
import { spacing } from '../ui/theme';
import { describeError } from '../errors';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your Lodestar username or email.'),
  password: z.string().min(1, 'Enter your Lodestar password.'),
});
type Values = z.infer<typeof schema>;

/**
 * Signs in to an EXISTING Tala account. The password goes once, over HTTPS, straight to the Tala server; only the tokens
 * Tala returns are kept (in secure storage). This form clears the password right after the attempt, success or not.
 */
export function TalaSignIn({
  expired,
  onSignIn,
}: {
  /** The session ran out: say so. */
  expired: boolean;
  onSignIn: (username: string, password: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, resetField } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });

  async function onSubmit(values: Values) {
    setError(null);
    setBusy(true);
    try {
      await onSignIn(values.username, values.password);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
      resetField('password');
    }
  }

  return (
    <FormScreen>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading" accessibilityRole="header">
          Sign in to Lodestar
        </AppText>
        {expired ? (
          <Notice tone="warning" message="Your Lodestar session ended. Sign in again to continue." />
        ) : null}
        <AppText muted>
          Use the username and password you already have for Lodestar. Your password is not stored.
          New Lodestar accounts cannot be created here.
        </AppText>
        <FormError message={error} />
        <View style={{ gap: spacing.md }}>
          <TextField
            control={control}
            name="username"
            label="Lodestar username or email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
          />
          <TextField
            control={control}
            name="password"
            label="Lodestar password"
            secure
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
          />
        </View>
        <Button title="Sign in" loading={busy} onPress={() => void handleSubmit(onSubmit)()} />
      </Card>
    </FormScreen>
  );
}
