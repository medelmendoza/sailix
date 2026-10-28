import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { AppText, Button, FormError, Notice, TextField } from '../ui';
import { useBrand } from '../ui/brand';
import { colors, shadows, spacing } from '../ui/theme';
import { describeError } from '../errors';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your Lodestar username or email.'),
  password: z.string().min(1, 'Enter your Lodestar password.'),
});
type Values = z.infer<typeof schema>;

const LOGO = require('../assets/lodestar-logo.png');

/**
 * Signs in to an EXISTING Lodestar account. The password goes once, over HTTPS, straight to the server; only the tokens it
 * returns are kept (in secure storage). The form clears the password right after the attempt, success or not.
 * A gradient banner with the logo, and the form on a card that overlaps it.
 */
export function TalaSignIn({
  expired,
  onSignIn,
}: {
  /** The session ran out: say so. */
  expired: boolean;
  onSignIn: (username: string, password: string) => Promise<void>;
}) {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, resetField } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });

  async function onSubmit(values: Values) {
    setError(null);
    setBusy(true);
    try {
      await onSignIn(values.username, values.password);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
      resetField('password');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View
          key={brand.gradients.header} // the gradient is rebuilt, not changed, when the look changes
          style={[
            styles.banner,
            {
              paddingTop: insets.top + spacing.xxl,
              backgroundColor: brand.primary,
              experimental_backgroundImage: brand.gradients.header,
            },
          ]}
        >
          <View style={styles.logoWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image source={LOGO} style={styles.logo} />
          </View>
          <AppText style={styles.name} accessibilityRole="header">
            Lodestar
          </AppText>
          <AppText style={styles.tagline}>Sign in to continue your courses.</AppText>
        </View>

        <View style={styles.card}>
          {expired ? (
            <Notice tone="warning" message="Your Lodestar session ended. Sign in again to continue." />
          ) : null}
          <AppText variant="heading" accessibilityRole="header">
            Welcome back
          </AppText>
          <AppText variant="caption" muted>
            Use the username and password you already have for Lodestar. Your password is not stored.
          </AppText>
          <FormError message={error} />
          <View style={{ gap: spacing.md }}>
            <TextField
              control={control}
              name="username"
              label="Lodestar username or email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
            <TextField
              control={control}
              name="password"
              label="Lodestar password"
              secure
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
          </View>
          <Button title="Sign in" loading={busy} onPress={() => void handleSubmit(onSubmit)()} />
        </View>
        <AppText variant="caption" muted style={styles.footer}>
          New Lodestar accounts cannot be created here.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xxxl + spacing.xl, // the card overlaps this
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
  },
  logo: { width: 88, height: 88 },
  name: { color: '#FFFFFF', fontFamily: 'Quicksand_700Bold', fontSize: 34, lineHeight: 40 },
  tagline: { color: 'rgba(255,255,255,0.88)' },
  card: {
    marginTop: -spacing.xxxl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
    boxShadow: shadows.raised,
  },
  footer: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});
