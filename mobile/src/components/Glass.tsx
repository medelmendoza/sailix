import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';

/** DESIGN TRIAL ("soft glass"): translucent cards over a blue-to-teal ground. No blur library: translucency only. */
export const GLASS_TOP = '#2B4E9B';

export function GlassBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.ground}>
      <View style={[styles.orb, styles.orbA]} />
      <View style={[styles.orb, styles.orbB]} />
      {children}
    </View>
  );
}

/** Makes the navigation header match the glass ground (blue, white title and arrow). */
export function useGlassHeader() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: GLASS_TOP },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: { color: '#FFFFFF' },
    });
  }, [navigation]);
}

export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A pill button for the glass ground: solid white ("solid") or a translucent outline. */
export function GlassButton({
  title,
  onPress,
  solid,
}: {
  title: string;
  onPress: () => void;
  solid?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        solid ? styles.buttonSolid : styles.buttonOutline,
        pressed && { opacity: 0.8 },
      ]}
    >
      <AppText variant="button" style={{ color: solid ? colors.primary : '#FFFFFF' }}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: GLASS_TOP,
    experimental_backgroundImage: 'linear-gradient(170deg, #2B4E9B 0%, #2A7F8F 100%)',
  },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  orbA: { width: 260, height: 260, top: 120, right: -90 },
  orbB: { width: 200, height: 200, bottom: 80, left: -70 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 24,
    padding: spacing.xl,
    boxShadow: '0 8px 24px rgba(10, 30, 70, 0.25)',
  },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonSolid: { backgroundColor: '#FFFFFF' },
  buttonOutline: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
