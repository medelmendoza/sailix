import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { AppText, Button, FormError, FormScreen, Notice, TextField } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { applyServerErrors } from '@/features/auth/serverErrors';
import { api } from '@/services/api/client';

const CATEGORIES = [
  { value: 'bug', label: 'Something is wrong' },
  { value: 'idea', label: 'An idea' },
  { value: 'other', label: 'Other' },
] as const;

const schema = z.object({
  category: z.enum(['bug', 'idea', 'other']),
  message: z
    .string()
    .trim()
    .min(3, 'Write a few words.')
    .max(2000, 'Keep it under 2000 characters.'),
});
type Values = z.infer<typeof schema>;

/** Feedback about the Sailix app, sent to the organization's administrators (not to Tala). */
export function SendFeedbackScreen() {
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
    defaultValues: { category: 'idea', message: '' },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    setDone(false);
    try {
      await api.post('/me/feedback', values);
      setDone(true);
      reset();
    } catch (e) {
      setFormError(applyServerErrors(e, setError, ['category', 'message']));
    }
  }

  return (
    <FormScreen>
      {done ? (
        <Notice tone="success" message="Thank you. Your feedback was sent to your organization." />
      ) : null}
      <FormError message={formError} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption">What is it about?</AppText>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CATEGORIES.map((c) => {
                const picked = field.value === c.value;
                return (
                  <Pressable
                    key={c.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: picked }}
                    accessibilityLabel={c.label}
                    onPress={() => field.onChange(c.value)}
                    style={[styles.chip, picked && styles.chipPicked]}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: picked ? colors.onPrimary : colors.text }}
                    >
                      {c.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </View>
      <TextField
        control={control}
        name="message"
        label="Your feedback"
        multiline
        textAlignVertical="top"
        maxLength={2000}
        style={styles.message}
      />
      <Button title="Send feedback" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPicked: { backgroundColor: colors.primary, borderColor: colors.primary },
  message: { minHeight: 140 },
});
