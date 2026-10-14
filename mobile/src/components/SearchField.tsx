import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, minTouchTarget, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { GlyphIcon } from './GlyphIcon';

/** A rounded search box with a magnifier and a clear button. */
export function SearchField({
  value,
  onChangeText,
  label,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <View style={styles.box}>
      <GlyphIcon name="search" color={colors.textMuted} size={20} />
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        maxLength={100}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
          style={styles.clear}
        >
          <AppText variant="caption" style={{ color: colors.textMuted }}>
            ✕
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text, paddingVertical: 0 },
  clear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
});
