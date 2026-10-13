import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { AppText, Button, Card, FormError, Notice, TextField } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useLinkTala } from './api';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your Tala username or email.'),
  password: z.string().min(1, 'Enter your Tala password.'),
});
type Values = z.infer<typeof schema>;

/**
 * Links an EXISTING Tala account. The password is sent once over HTTPS to the Sailix server, which verifies it with
 * Tala and keeps only encrypted tokens; this form clears it right after the attempt, success or not.
 */
export function TalaLinkForm({ relink }: { relink: boolean }) {
  const link = useLinkTala();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, resetField } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await link.mutateAsync(values);
    } catch (e) {
      setError(describeError(e));
    } finally {
      resetField('password');
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        {relink ? 'Link your Tala account again' : 'Link your Tala account'}
      </AppText>
      {relink ? (
        <Notice tone="warning" message="Your Tala link expired. Enter your Tala details again." />
      ) : null}
      <AppText muted>
        Use the username and password you already have for Tala. Your password is not stored by
        Sailix. New Tala accounts cannot be created here.
      </AppText>
      <FormError message={error} />
      <View style={{ gap: spacing.md }}>
        <TextField
          control={control}
          name="username"
          label="Tala username or email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
        />
        <TextField
          control={control}
          name="password"
          label="Tala password"
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
        />
      </View>
      <Button
        title="Link account"
        loading={link.isPending}
        onPress={() => void handleSubmit(onSubmit)()}
      />
    </Card>
  );
}
