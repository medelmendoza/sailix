import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { Card } from './Card';

/**
 * The sign-in family of screens: the blue-to-teal header of the Dashboard with the Sailix logo in a white badge, a title and a
 * line under it, and the form on a white card that overlaps the header.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}>
          <View
            style={styles.logo}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={require('../../assets/brand/sailix-logo.png')}
              resizeMode="contain"
              style={styles.sail}
            />
          </View>
          <AppText variant="title" accessibilityRole="header" style={styles.white}>
            {title}
          </AppText>
          <AppText style={styles.white}>{subtitle}</AppText>
        </View>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Card variant="flat" style={styles.card}>
            {children}
          </Card>
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.header,
  },
  logo: {
    height: 64,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  sail: { width: 92, height: 44 },
  white: { color: colors.onPrimary },
  sheet: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -spacing.xxl },
  card: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.lg },
});
