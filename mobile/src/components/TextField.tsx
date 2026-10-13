import { useState } from 'react';
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, minTouchTarget, radius, shadows, spacing } from '@/constants/theme';
import { AppText } from './AppText';

type Props<T extends FieldValues> = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'onBlur' | 'secureTextEntry'
> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  /** Password-style field with an accessible show/hide toggle. */
  secure?: boolean;
};

/** Labelled text input bound to react-hook-form; the error is announced to screen readers. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  secure,
  ...inputProps
}: Props<T>) {
  const { field, fieldState } = useController({ control, name });
  const [revealed, setRevealed] = useState(false);
  const error = fieldState.error?.message;

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.box, error ? styles.boxError : null]}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          accessibilityHint={hint}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          secureTextEntry={secure && !revealed}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
            onPress={() => setRevealed((v) => !v)}
            style={styles.toggle}
          >
            <AppText variant="caption" style={{ color: colors.accent }}>
              {revealed ? 'Hide' : 'Show'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {hint && !error ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
      {error ? (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger }}
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {},
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    boxShadow: shadows.inset, // a field is a well pressed into the surface
  },
  boxError: { borderColor: colors.danger },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    minHeight: minTouchTarget,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
