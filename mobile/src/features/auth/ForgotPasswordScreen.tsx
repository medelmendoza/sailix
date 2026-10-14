import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import type { AuthStackParamList } from '@/app/navigation/types';
import { AppText, AuthLayout, Button, FormError, LinkButton, TextField } from '@/components';
import { api, PUBLIC_CALL } from '@/services/api/client';
import { applyServerErrors } from './serverErrors';

const schema = z.object({ email: z.email('Enter a valid email address.') });
type Values = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.post('/auth/forgot-password', values, PUBLIC_CALL);
      setSent(true);
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['email']));
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="The link is on its way.">
        {/* Same text whether or not the address has an account. */}
        <AppText>
          If an account exists for that address, we sent a link to reset the password. The link
          works once and expires in 60 minutes. It opens in your browser.
        </AppText>
        <Button title="Back to sign in" onPress={() => navigation.popToTop()} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will email you a link."
      footer={
        <View style={{ alignItems: 'center' }}>
          <LinkButton title="Back to sign in" onPress={() => navigation.popToTop()} />
        </View>
      }
    >
      <FormError message={formError} />
      <TextField
        control={control}
        name="email"
        label="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Button title="Send reset link" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
    </AuthLayout>
  );
}
