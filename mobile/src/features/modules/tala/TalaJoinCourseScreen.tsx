import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppText, Button, FormError, FormScreen, Notice, TextField } from '@/components';
import { applyServerErrors } from '@/features/auth/serverErrors';
import { scopedKey } from '@/store/scopedKey';
import { joinTalaCourse } from './api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter the course code.')
    .max(64, 'That code is too long.')
    .regex(/^[A-Za-z0-9_-]+$/, 'A course code has only letters, numbers, - and _.'),
});
type Values = z.infer<typeof schema>;

/**
 * Applies to join a course with a code from the course creator. The server sends it to Tala for the linked account only;
 * Tala usually has an administrator approve, so the success message says "requested", never "joined".
 */
export function TalaJoinCourseScreen() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } });

  async function onSubmit(values: Values) {
    setFormError(null);
    setRequested(false);
    try {
      await joinTalaCourse(values.code);
      setRequested(true);
      reset();
      await queryClient.invalidateQueries({ queryKey: scopedKey('tala') });
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['code']));
    }
  }

  return (
    <FormScreen>
      <AppText muted>
        Ask your course creator for the course code. Your request is sent to Tala for the account
        you linked.
      </AppText>
      {requested ? (
        <Notice
          tone="success"
          message="Request sent. The course appears in My courses once it is approved."
        />
      ) : null}
      <FormError message={formError} />
      <TextField
        control={control}
        name="code"
        label="Course code"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={64}
      />
      <Button title="Request to join" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
    </FormScreen>
  );
}
