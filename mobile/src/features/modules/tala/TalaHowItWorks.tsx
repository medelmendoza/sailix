import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { useBrand } from '@/theme/brand';

/** The rules of a Tala course in one quiet line; the full text opens on request instead of filling the page. */
export function TalaHowItWorks({ message }: { message: string }) {
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.box, { backgroundColor: brand.infoBg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How this course works"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}
      >
        <View style={[styles.badge, { backgroundColor: brand.primary }]}>
          <AppText style={styles.badgeText}>i</AppText>
        </View>
        <AppText style={[styles.title, { color: brand.primary }]}>How this course works</AppText>
        <AppText variant="caption" style={{ color: brand.primary }}>
          {open ? 'Hide' : 'Show'}
        </AppText>
      </Pressable>
      {open ? (
        <AppText variant="caption" style={[styles.text, { color: brand.primary }]}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, backgroundColor: colors.infoBg, paddingHorizontal: spacing.lg },
  row: { minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.onPrimary,
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    lineHeight: 18,
  },
  title: { flex: 1, fontFamily: 'Quicksand_700Bold', fontSize: 15, color: colors.primary },
  text: { color: colors.primary, paddingBottom: spacing.lg },
});
