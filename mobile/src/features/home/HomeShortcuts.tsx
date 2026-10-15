import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, GlyphIcon, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/** The three round shortcuts under the counters. */
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

type Counter = {
  title: string;
  /** What a screen reader says after the title (the same words the tiles used). */
  note: string | null;
  big: string;
  line: string;
  /** The text colour, and the soft background that goes with it. */
  ink: string;
  bg: string;
  icon: React.ReactNode;
  onPress: () => void;
};

/**
 * Three separate tiles that overlap the header: what is open on the to-do list, which documents need attention, and how
 * many announcements are new. Each takes a soft colour from how it is doing (green, amber, red, blue, or grey).
 */
export function TodayCard({ counters }: { counters: Counter[] }) {
  return (
    <View style={styles.counters}>
      {counters.map((c) => (
        <Pressable
          key={c.title}
          accessibilityRole="button"
          accessibilityLabel={c.note ? `${c.title}, ${c.note}` : c.title}
          onPress={c.onPress}
          style={({ pressed }) => [
            styles.counter,
            { backgroundColor: c.bg },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={styles.counterIcon} accessibilityElementsHidden>
            {c.icon}
          </View>
          <AppText style={[styles.big, { color: c.ink }]} accessibilityElementsHidden>
            {c.big}
          </AppText>
          <AppText
            variant="button"
            style={[styles.center, { color: c.ink }]}
            accessibilityElementsHidden
          >
            {c.title}
          </AppText>
          <AppText
            variant="caption"
            style={[styles.center, { color: c.ink }]}
            accessibilityElementsHidden
          >
            {c.line}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  quick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
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
  counters: { flexDirection: 'row', gap: spacing.sm },
  counter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderRadius: radius.lg,
    boxShadow: '0 4px 14px rgba(18, 36, 61, 0.14)',
  },
  counterIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  big: { fontFamily: 'Quicksand_700Bold', fontSize: 34, lineHeight: 40 },
});
