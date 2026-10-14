import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import type { AuthStackParamList } from '@/app/navigation/types';
import { AppText, AuthLayout, Button, FormError, LinkButton, TextField } from '@/components';
import { spacing } from '@/constants/theme';
import { api, PUBLIC_CALL } from '@/services/api/client';
import { applyServerErrors } from './serverErrors';

const optional = (max: number) => z.string().trim().max(max, `At most ${max} characters.`);

const schema = z
  .object({
    agency_code: z
      .string()
      .trim()
      .min(1, 'Enter your organization code.')
      .regex(/^[A-Za-z0-9]+$/, 'Letters and digits only.')
      .max(32),
    first_name: z.string().trim().min(1, 'Enter your first name.').max(100),
    middle_name: optional(100),
    last_name: z.string().trim().min(1, 'Enter your last name.').max(100),
    suffix: optional(20),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{3,64}$/, '3–64 letters, digits, . _ - only.'),
    email: z.email('Enter a valid email address.'),
    mobile: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number.'),
    password: z.string().min(8, 'Use at least 8 characters.').max(1024),
    password_confirmation: z.string().min(1, 'Repeat the password.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The passwords do not match.',
  });
type Values = z.infer<typeof schema>;

const FIELDS = [
  'agency_code',
  'first_name',
  'middle_name',
  'last_name',
  'suffix',
  'username',
  'email',
  'mobile',
  'password',
] as const;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      agency_code: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      suffix: '',
      username: '',
      email: '',
      mobile: '',
      password: '',
      password_confirmation: '',
    },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.post(
        '/auth/register',
        {
          ...values,
          // blank optional fields are omitted, not sent as empty text
          middle_name: values.middle_name || undefined,
          suffix: values.suffix || undefined,
          mobile: values.mobile || undefined,
        },
        PUBLIC_CALL,
      );
      navigation.replace('RegisterDone');
    } catch (e) {
      setFormError(applyServerErrors(e, setError, FIELDS));
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Your organization approves new accounts before you can sign in."
      footer={
        <View style={styles.footer}>
          <AppText muted>Already registered?</AppText>
          <LinkButton title="I already have an account" onPress={() => navigation.popToTop()} />
        </View>
      }
    >
      <FormError message={formError} />
      <TextField
        control={control}
        name="agency_code"
        label="Organization code"
        hint="Ask your organization if you do not know it."
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TextField control={control} name="first_name" label="First name" autoComplete="given-name" />
      <TextField control={control} name="middle_name" label="Middle name (optional)" />
      <TextField control={control} name="last_name" label="Last name" autoComplete="family-name" />
      <TextField control={control} name="suffix" label="Suffix (optional)" />
      <TextField
        control={control}
        name="username"
        label="Username"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
      />
      <TextField
        control={control}
        name="email"
        label="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <TextField
        control={control}
        name="mobile"
        label="Mobile number (optional)"
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <TextField
        control={control}
        name="password"
        label="Password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        hint="At least 8 characters (your organization may require more)."
      />
      <TextField
        control={control}
        name="password_confirmation"
        label="Repeat the password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <Button title="Create account" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: spacing.xs },
});
