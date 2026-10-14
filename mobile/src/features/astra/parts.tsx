import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { AppText, Button, Card, GlyphIcon, type GlyphName } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/**
 * The "What is ...?" explanation, as in the original: a round "?" in the header opens a sheet that slides up from the
 * bottom. Call it from a screen and render the returned element anywhere in that screen.
 */
export function useHelp({ title, body }: { title: string; body: string }) {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Help"
          onPress={() => setOpen(true)}
          hitSlop={8}
          style={styles.helpButton}
        >
          <GlyphIcon name="quiz" color={colors.primary} size={26} />
        </Pressable>
      ),
    });
  }, [navigation]);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable
        accessibilityLabel="Close help"
        accessibilityRole="button"
        style={styles.scrim}
        onPress={() => setOpen(false)}
      />
      <View style={styles.sheet}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        <AppText>{body}</AppText>
        <Button title="Got it" variant="secondary" onPress={() => setOpen(false)} />
      </View>
    </Modal>
  );
}

/** A square menu tile: a round icon over a bold title, two to a row (the original's menu grid). */
export function GridTile({
  title,
  glyph,
  tone = 'primary',
  image,
  onPress,
  label,
  glass,
}: {
  title: string;
  glyph?: GlyphName;
  glass?: boolean;
  tone?: 'primary' | 'teal' | 'coral';
  image?: ImageSourcePropType;
  onPress: () => void;
  label?: string;
}) {
  const bg = tone === 'primary' ? colors.primary : tone === 'teal' ? '#2A7F8F' : colors.coralText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.gridCell, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.gridTile, glass ? styles.glassTile : { backgroundColor: bg }]}>
        {image ? (
          <Image source={image} accessibilityElementsHidden style={styles.gridImage} />
        ) : glyph ? (
          <View style={styles.gridIcon}>
            <GlyphIcon name={glyph} color={colors.onPrimary} size={34} />
          </View>
        ) : null}
        <AppText variant="heading" style={styles.gridTitle}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Lays grid tiles out two to a row. */
export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** A word on a coloured tag, with what it stands for next to it. */
export function Pair({
  word,
  covers,
  tone = 'primary',
}: {
  word: string;
  covers: string;
  tone?: 'primary' | 'accent';
}) {
  return (
    <View style={styles.pair} accessible accessibilityLabel={`${word}: ${covers}`}>
      <View
        style={[
          styles.tag,
          { backgroundColor: tone === 'primary' ? colors.primary : colors.coralText },
        ]}
      >
        <AppText variant="button" style={{ color: colors.onPrimary }}>
          {word}
        </AppText>
      </View>
      <AppText style={styles.covers}>{covers}</AppText>
    </View>
  );
}

export function Tile({
  title,
  note,
  onPress,
}: {
  title: string;
  note?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
    >
      <Card style={styles.tileCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{title}</AppText>
          {note ? (
            <AppText variant="caption" muted>
              {note}
            </AppText>
          ) : null}
        </View>
        <AppText muted>›</AppText>
      </Card>
    </Pressable>
  );
}

export function Picture({ source, label }: { source: ImageSourcePropType; label: string }) {
  return (
    <Image source={source} accessibilityLabel={label} resizeMode="contain" style={styles.picture} />
  );
}

const styles = StyleSheet.create({
  helpButton: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: { flex: 1, backgroundColor: 'rgba(18, 36, 61, 0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { width: '48%', aspectRatio: 1 },
  gridTile: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    overflow: 'hidden',
  },
  glassTile: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    boxShadow: '0 8px 24px rgba(10, 30, 70, 0.25)',
  },
  gridIcon: { height: 44, alignItems: 'center', justifyContent: 'center' },
  gridImage: { width: 64, height: 64, borderRadius: radius.md },
  gridTitle: { color: colors.onPrimary, textAlign: 'center' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouchTarget },
  tag: {
    minWidth: 120,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  covers: { flex: 1 },
  tile: { minHeight: minTouchTarget },
  tileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  picture: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
});
