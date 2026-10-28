import { Image, StyleSheet, View } from 'react-native';

const LOGO = require('../assets/lodestar-logo.png');

/** The Lodestar logo in a rounded square. Decorative: the name always sits next to it. */
export function LodestarLogo({ size = 60 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: Math.round(size * 0.27) }]}
    >
      <Image source={LOGO} style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)' },
});
