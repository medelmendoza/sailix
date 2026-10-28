import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, typography } from './theme';
import { useBrand } from './brand';

type Variant = keyof typeof typography;

/**
 * Body text follows the person's text-size setting all the way up (to the largest accessibility size). Big headings stop
 * earlier: at the largest size a 28-point title would otherwise break words in half ("Accoun/t") and fill the screen.
 */
export const MAX_FONT_SCALE: Record<Variant, number> = {
  title: 1.5,
  heading: 1.8,
  body: 3.5,
  caption: 3.5,
  button: 3.5,
};
type Props = TextProps & { variant?: Variant; muted?: boolean };

/**
 * Every piece of text in the app. It wears the organization's text colour and font style: where a screen names the Sailix
 * ink (`colors.text`, `colors.textMuted`) or one of the app's fonts, it is drawn with the organization's instead. A colour
 * that is neither (white on a button, red for an error) is left as it is.
 */
export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  const brand = useBrand();
  const flat = StyleSheet.flatten(style) ?? {};
  const base = typography[variant];
  const named = flat.color ?? (muted ? colors.textMuted : colors.text);
  const color =
    named === colors.text ? brand.text : named === colors.textMuted ? brand.textMuted : named;
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE[variant]}
      {...rest}
      style={[base, style, { color }, brand.font(flat.fontFamily ?? base.fontFamily)]}
    />
  );
}
