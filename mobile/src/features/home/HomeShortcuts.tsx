import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, GlyphIcon, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/** The three round shortcuts of the dashboard. */
export function QuickActions({
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
    <Card variant="flat" style={styles.quick}>
      {items.map((i) => (
        <Pressable
          key={i.label}
          accessibilityRole="button"
          accessibilityLabel={i.label}
          onPress={i.onPress}
          style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.circle}>{i.icon}</View>
          <AppText variant="caption" style={styles.center}>
            {i.label}
          </AppText>
        </Pressable>
      ))}
    </Card>
  );
}

/** One of the two tiles under the shortcuts (To-do list, Documents): a round icon, the title and a short live note. */
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
        <View style={styles.circle}>{icon}</View>
        <AppText variant="heading" style={styles.center}>
          {title}
        </AppText>
        {note ? (
          <AppText
            variant="caption"
            style={[styles.center, { color: noteColor ?? colors.textMuted }]}
          >
            {note}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  quick: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  quickItem: { flex: 1, alignItems: 'center', gap: spacing.sm, minHeight: minTouchTarget },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  tile: { flex: 1, minHeight: minTouchTarget },
  tileCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
});
