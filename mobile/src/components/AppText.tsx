import { Text, type TextProps } from 'react-native';
import { colors, typography } from '@/constants/theme';

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

export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE[variant]}
      {...rest}
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}
