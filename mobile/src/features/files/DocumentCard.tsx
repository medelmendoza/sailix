import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components';
import { minTouchTarget, radius, spacing } from '@/constants/theme';
import type { CrewDocument } from '@/services/api/types';
import { documentBadge } from './expiry';

export function DocumentCard({ doc, onPress }: { doc: CrewDocument; onPress: () => void }) {
  const badge = documentBadge(doc);
  const summary = [doc.number, doc.expires_on ? `expires ${doc.expires_on}` : 'no expiry date']
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${doc.type.name}, ${badge?.text ?? 'no expiry date'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <AppText variant="heading" style={styles.title}>
            {doc.type.name}
          </AppText>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.background }]}>
              <AppText variant="caption" style={{ color: badge.color }}>
                {badge.text}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText muted>{summary}</AppText>
        {doc.status === 'rejected' && doc.rejection_reason ? (
          <AppText variant="caption" style={styles.reason}>
            {doc.rejection_reason}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { minHeight: minTouchTarget },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  reason: { color: '#B3362F' },
});
