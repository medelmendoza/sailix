import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors } from './theme';
import { useBrand } from './brand';

/**
 * A text input in the organization's text colour and font style (and its quieter colour for the placeholder). Like AppText:
 * where a screen names the Sailix ink or font it is drawn with the organization's instead; any other colour is left alone.
 */
export function BrandTextInput({ style, placeholderTextColor, ...rest }: TextInputProps) {
  const brand = useBrand();
  const flat = StyleSheet.flatten(style) ?? {};
  const color = flat.color === undefined || flat.color === colors.text ? brand.text : flat.color;
  const placeholder =
    placeholderTextColor === undefined || placeholderTextColor === colors.textMuted
      ? brand.textMuted
      : placeholderTextColor;
  return (
    <TextInput
      {...rest}
      placeholderTextColor={placeholder}
      style={[style, { color }, brand.font(flat.fontFamily ?? 'Nunito_400Regular')]}
    />
  );
}
