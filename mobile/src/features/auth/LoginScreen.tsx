import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import type { AuthStackParamList } from '@/app/navigation/types';
import {
  AppText,
  AuthLayout,
  Button,
  FormError,
  LinkButton,
  Notice,
  TextField,
} from '@/components';
import { spacing } from '@/constants/theme';
import { api, PUBLIC_CALL } from '@/services/api/client';
import type { Envelope, SelectionRequired, TokenGrant } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';
import { applyServerErrors } from './serverErrors';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username or email.'),
  password: z.string().min(1, 'Enter your password.'),
});
type Values = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const deviceName = () => `Sailix ${Platform.OS}`;

export function LoginScreen({ navigation }: Props) {
  const notice = useSessionStore((s) => s.notice);
  const clearNotice = useSessionStore((s) => s.clearNotice);
  const completeSignIn = useSessionStore((s) => s.completeSignIn);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    clearNotice();
    try {
      const res = await api.post<Envelope<TokenGrant | SelectionRequired>>(
        '/auth/token',
        { username: values.username, password: values.password, device_name: deviceName() },
        PUBLIC_CALL,
      );
      const data = res.data.data;
      if ('requires_tenant_selection' in data) {
        navigation.navigate('SelectOrganization', {
          ticket: data.ticket,
          memberships: data.memberships,
        });
        return;
      }
      await completeSignIn(data);
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['username', 'password']));
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back"
      footer={
        <View style={styles.footer}>
          <AppText muted>New to Sailix?</AppText>
          <LinkButton title="Create an account" onPress={() => navigation.navigate('Register')} />
        </View>
      }
    >
      {notice ? <Notice tone="warning" message={notice} /> : null}
      <FormError message={formError} />
      <TextField
        control={control}
        name="username"
        label="Username or email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        control={control}
        name="password"
        label="Password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit(onSubmit)}
      />
      <Button title="Sign in" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
      <LinkButton
        title="Forgot your password?"
        onPress={() => navigation.navigate('ForgotPassword')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: spacing.xs },
});
