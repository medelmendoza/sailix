import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, FormError, FormScreen, Notice, TextField } from '@/components';
import { applyServerErrors } from '@/features/auth/serverErrors';
import { api } from '@/services/api/client';

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password.'),
    password: z.string().min(8, 'Use at least 8 characters.').max(1024),
    password_confirmation: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The passwords do not match.',
  })
  .refine((v) => v.password !== v.current_password, {
    path: ['password'],
    message: 'Choose a different password.',
  });
type Values = z.infer<typeof schema>;

export function ChangePasswordScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    setDone(false);
    try {
      await api.put('/me/password', values);
      setDone(true);
      reset();
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['current_password', 'password']));
    }
  }

  return (
    <FormScreen>
      {done ? (
        <Notice tone="success" message="Password changed. Your other devices were signed out." />
      ) : null}
      <FormError message={formError} />
      <TextField
        control={control}
        name="current_password"
        label="Current password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
      />
      <TextField
        control={control}
        name="password"
        label="New password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <TextField
        control={control}
        name="password_confirmation"
        label="Repeat the new password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <Button title="Change password" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
    </FormScreen>
  );
}
