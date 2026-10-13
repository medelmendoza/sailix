import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, GlyphIcon, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, shadows, spacing } from '@/constants/theme';

type Shortcut = { label: string; icon: React.ReactNode; onPress: () => void };

/** The four quick ways in the old Sailix dashboard had: upload a document, open finances, the to-do list, and your documents. */
export function HomeShortcuts({
  onUpload,
  onFinance,
  onTodos,
  onFiles,
}: {
  onUpload: () => void;
  onFinance: () => void;
  onTodos: () => void;
  onFiles: () => void;
}) {
  const items: Shortcut[] = [
    {
      label: 'Upload a document',
      icon: (
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <GlyphIcon name="download" color={colors.onPrimary} size={26} />
        </View>
      ),
      onPress: onUpload,
    },
    {
      label: 'Finance',
      icon: <TabIcon name="coins" color={colors.onPrimary} />,
      onPress: onFinance,
    },
    {
      label: 'To-do list',
      icon: <GlyphIcon name="check" color={colors.onPrimary} size={26} />,
      onPress: onTodos,
    },
    {
      label: 'My documents',
      icon: <TabIcon name="folder" color={colors.onPrimary} />,
      onPress: onFiles,
    },
  ];
  return (
    <View style={styles.row}>
      {items.map((i) => (
        <Pressable
          key={i.label}
          accessibilityRole="button"
          accessibilityLabel={i.label}
          onPress={i.onPress}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.circle}>{i.icon}</View>
          <AppText variant="caption" style={styles.label}>
            {i.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  item: { flex: 1, alignItems: 'center', gap: spacing.sm, minHeight: minTouchTarget },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.raisedSm,
  },
  label: { textAlign: 'center' },
});
