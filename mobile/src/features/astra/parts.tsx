import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { AppText, Card } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/** The "What is ...?" explanation, shown at the top of a screen (the original used a bottom sheet). */
export function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <Card variant="inset" style={styles.help}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText>{body}</AppText>
    </Card>
  );
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
  help: { gap: spacing.sm },
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
