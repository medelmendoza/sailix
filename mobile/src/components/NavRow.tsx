import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { GlyphIcon, type GlyphName } from './GlyphIcon';
import { useBrand } from '@/theme/brand';

/** A flat card row that opens something: a round light-blue icon, a title with a short note, and a chevron. */
export function NavRow({
  title,
  note,
  noteColor,
  glyph,
  icon,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  note?: string;
  noteColor?: string;
  glyph: GlyphName;
  /** Replaces the round glyph (a service's logo). */
  icon?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const brand = useBrand();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
    >
      <Card variant="flat" style={styles.card}>
        {icon ?? (
          <View style={[styles.icon, { backgroundColor: brand.infoBg }]}>
            <GlyphIcon name={glyph} size={26} />
          </View>
        )}
        <View style={styles.text}>
          <AppText variant="heading">{title}</AppText>
          {note ? (
            <AppText variant="caption" style={{ color: noteColor ?? colors.textMuted }}>
              {note}
            </AppText>
          ) : null}
        </View>
        <AppText muted>›</AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { minHeight: minTouchTarget },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderRadius: radius.lg },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  text: { flex: 1, gap: 2 },
});
