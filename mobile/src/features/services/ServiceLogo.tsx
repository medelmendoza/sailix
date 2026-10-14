import { Image, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

const LOGO = {
  tala: require('../../../assets/brand/tala-logo.png'),
  astra: require('../../../assets/brand/astra-logo.png'),
  callit: require('../../../assets/brand/callit-logo.png'),
} as const;

export type LogoCode = keyof typeof LOGO;

export function hasLogo(code: string): code is LogoCode {
  return code in LOGO;
}

/** The service's own logo in a rounded square. Decorative: the service name always sits next to it. */
export function ServiceLogo({ code, size = 52 }: { code: LogoCode; size?: number }) {
  const transparent = code === 'callit'; // its mark has no background of its own, so it sits on white
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.box,
        { width: size, height: size, borderRadius: Math.round(size * 0.27) },
        transparent && styles.onWhite,
      ]}
    >
      <Image
        source={LOGO[code]}
        resizeMode="contain"
        style={{
          width: transparent ? size * 0.78 : size,
          height: transparent ? size * 0.78 : size,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  onWhite: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
  },
});
