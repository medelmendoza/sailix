import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, GlyphIcon, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/** A round blue button with an icon, used by the shortcuts and the two tiles. */
export function Circle({ children }: { children: React.ReactNode }) {
  return <View style={styles.circle}>{children}</View>;
}

/** The first card of the old Sailix dashboard: three round shortcuts. */
export function ShortcutsCard({
  onUpload,
  onFinance,
  onServices,
}: {
  onUpload: () => void;
  onFinance: () => void;
  onServices: () => void;
}) {
  const items = [
    {
      label: 'Upload documents',
      icon: (
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <GlyphIcon name="download" color={colors.primary} size={26} />
        </View>
      ),
      onPress: onUpload,
    },
    {
      label: 'View finances',
      icon: <TabIcon name="money" color={colors.primary} />,
      onPress: onFinance,
    },
    {
      label: 'Services',
      icon: <TabIcon name="case" color={colors.primary} />,
      onPress: onServices,
    },
  ];
  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.row}>
        {items.map((i) => (
          <Pressable
            key={i.label}
            accessibilityRole="button"
            accessibilityLabel={i.label}
            onPress={i.onPress}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
          >
            <Circle>{i.icon}</Circle>
            <AppText variant="caption" style={styles.label}>
              {i.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/** One of the two tiles under it (To-do list, Documents): a round icon, the title, and a short live note. */
export function Tile({
  title,
  note,
  noteColor,
  icon,
  onPress,
}: {
  title: string;
  note?: string | null;
  noteColor?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note ? `${title}, ${note}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
    >
      <Card variant="flat" style={styles.tileCard}>
        <Circle>{icon}</Circle>
        <AppText variant="heading" style={styles.label}>
          {title}
        </AppText>
        {note ? (
          <AppText
            variant="caption"
            style={[styles.label, { color: noteColor ?? colors.textMuted }]}
          >
            {note}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.xl, borderRadius: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.sm },
  item: { flex: 1, alignItems: 'center', gap: spacing.sm, minHeight: minTouchTarget },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
  tile: { flex: 1, minHeight: minTouchTarget },
  tileCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    flex: 1,
    borderRadius: 28,
  },
});
