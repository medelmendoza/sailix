import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components';
import { colors, minTouchTarget, spacing } from '@/constants/theme';
import type { Announcement } from '@/services/api/types';
import { ageLabel } from './age';

/** One announcement in a list: bold title with a dot while unread, a two-line preview and how long ago it was written. */
export function AnnouncementCard({
  announcement,
  onPress,
  flat,
}: {
  announcement: Announcement;
  onPress: () => void;
  /** Inside another card (the Dashboard): no raised card of its own. */
  flat?: boolean;
}) {
  const unread = announcement.is_read === false;
  const age = ageLabel(announcement.created_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread: ' : ''}${announcement.title}, ${age}`}
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
    >
      <Card
        variant={flat ? 'inset' : 'raised'}
        style={flat ? { ...styles.card, padding: spacing.lg } : styles.card}
      >
        <View style={styles.head}>
          {unread ? <View style={styles.dot} /> : null}
          <AppText variant="button" style={styles.title} numberOfLines={2}>
            {announcement.title}
          </AppText>
        </View>
        <AppText muted style={styles.preview} numberOfLines={2}>
          {announcement.body}
        </AppText>
        <AppText variant="caption" muted>
          {age}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { minHeight: minTouchTarget },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { flex: 1 },
  preview: { fontSize: 14, lineHeight: 20 },
});
