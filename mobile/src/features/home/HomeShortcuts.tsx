import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, GlyphIcon, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';

/** The four round shortcuts under the Today card. */
export function QuickActions({
  onUpload,
  onScan,
  onFinance,
  onServices,
}: {
  onUpload: () => void;
  onScan: () => void;
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
      label: 'Scan a document',
      icon: <GlyphIcon name="camera" color={colors.primary} size={26} />,
      onPress: onScan,
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
  ink: string;
  onPress: () => void;
};

/**
 * "Today": three live counters on one card that overlaps the header: what is open on the to-do list, which documents
 * need attention, and how many announcements are new.
 */
export function TodayCard({ counters }: { counters: Counter[] }) {
  return (
    <Card variant="flat" style={styles.today}>
      <AppText variant="caption" muted accessibilityRole="header">
        Today
      </AppText>
      <View style={styles.counters}>
        {counters.map((c, i) => (
          <Pressable
            key={c.title}
            accessibilityRole="button"
            accessibilityLabel={c.note ? `${c.title}, ${c.note}` : c.title}
            onPress={c.onPress}
            style={({ pressed }) => [
              styles.counter,
              i > 0 && styles.counterDivider,
              pressed && { opacity: 0.75 },
            ]}
          >
            <AppText style={[styles.big, { color: c.ink }]} accessibilityElementsHidden>
              {c.big}
            </AppText>
            <AppText variant="button" style={styles.center} accessibilityElementsHidden>
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
    </Card>
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
  today: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  counters: { flexDirection: 'row' },
  counter: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  counterDivider: { borderLeftWidth: 1, borderLeftColor: colors.borderSoft },
  big: { fontFamily: 'Quicksand_700Bold', fontSize: 34, lineHeight: 40 },
});
