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

/** A square menu tile: a round light-blue icon (or picture) over a bold title, two to a row. */
export function GridTile({
  title,
  glyph,
  image,
  onPress,
  label,
}: {
  title: string;
  glyph?: GlyphName;
  image?: ImageSourcePropType;
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.gridCell, pressed && { opacity: 0.75 }]}
    >
      <Card variant="flat" style={styles.gridTile}>
        {image ? (
          <Image source={image} accessibilityElementsHidden style={styles.gridImage} />
        ) : glyph ? (
          <View style={styles.gridIcon}>
            <GlyphIcon name={glyph} color={colors.primary} size={30} />
          </View>
        ) : null}
        <AppText variant="heading" style={styles.gridTitle}>
          {title}
        </AppText>
      </Card>
    </Pressable>
  );
}

/** Lays grid tiles out two to a row. */
export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** A coloured pill with a word on it (the old app's blue and orange buttons). */
export function Tag({ word, tone = 'primary' }: { word: string; tone?: 'primary' | 'accent' }) {
  return (
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
  );
}

/** Explanation text in a bordered box, under a tag. */
export function NoteBox({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <AppText variant="button" style={{ color: colors.text }}>
        {children}
      </AppText>
    </View>
  );
}

/** A tag with its explanation under it: one item of SCARIL, RAID, BLUF, To and CC. */
export function TagNote({
  word,
  covers,
  tone,
}: {
  word: string;
  covers: string;
  tone?: 'primary' | 'accent';
}) {
  return (
    <View style={styles.tagNote} accessible accessibilityLabel={`${word}: ${covers}`}>
      <Tag word={word} tone={tone} />
      <NoteBox>{covers}</NoteBox>
    </View>
  );
}

/** A small round arrow pointing down, between two steps. */
export function DownArrow() {
  return (
    <View style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.chevron} />
    </View>
  );
}

/** The centered bold title and optional line under it that the old Astra screens open with. */
export function CenterTitle({ title, sub }: { title?: string; sub?: string }) {
  return (
    <View style={styles.centerTitle}>
      {title ? (
        <AppText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {title}
        </AppText>
      ) : null}
      {sub ? (
        <AppText variant="button" style={{ textAlign: 'center' }}>
          {sub}
        </AppText>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  gridIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  gridImage: { width: 64, height: 64, borderRadius: radius.md },
  gridTitle: { textAlign: 'center' },
  tag: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  tagNote: { gap: spacing.sm },
  arrow: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  chevron: {
    width: 12,
    height: 12,
    marginTop: -4,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  centerTitle: { gap: spacing.sm, alignItems: 'center' },
  tile: { minHeight: minTouchTarget },
  tileCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  picture: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
});
