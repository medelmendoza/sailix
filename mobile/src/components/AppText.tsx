import { Text, type TextProps } from 'react-native';
import { colors, typography } from '@/constants/theme';

type Variant = keyof typeof typography;
type Props = TextProps & { variant?: Variant; muted?: boolean };

export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}
