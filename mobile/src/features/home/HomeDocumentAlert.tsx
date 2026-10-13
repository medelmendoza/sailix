import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import { expiryBadge } from '@/features/files/expiry';
import { useDocuments } from '@/features/files/api';

/**
 * Dashboard card for documents that need attention. The old app counted expired documents and never showed the number.
 * Like the other Home cards it never gets in the way: it renders nothing while loading, on error, or when all is well.
 */
export function HomeDocumentAlert({ onOpen }: { onOpen: () => void }) {
  const docs = useDocuments('approved');
  const all = docs.data?.data ?? [];
  const attention = all
    .filter((d) => d.expiry_status === 'expired' || d.expiry_status === 'expiring')
    .sort((a, b) =>
      a.expiry_status === b.expiry_status ? 0 : a.expiry_status === 'expired' ? -1 : 1,
    );
  if (attention.length === 0) return null;

  const { expired, expiring } = docs.data!.counts;
  const parts = [
    expired > 0 ? `${expired} expired` : null,
    expiring > 0 ? `${expiring} expiring soon` : null,
  ].filter(Boolean);

  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        Documents need attention
      </AppText>
      <AppText muted>{parts.join(', ')}</AppText>
      {attention.slice(0, 3).map((d) => {
        const badge = expiryBadge(d.expiry_status)!;
        return (
          <View
            key={d.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${d.type.name}, ${badge.text}`}
          >
            <AppText style={{ flex: 1 }}>{d.type.name}</AppText>
            <View style={[styles.badge, { backgroundColor: badge.background }]}>
              <AppText variant="caption" style={{ color: badge.color }}>
                {badge.text}
              </AppText>
            </View>
          </View>
        );
      })}
      <Button title="Open my documents" variant="secondary" onPress={onOpen} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderColor: colors.warning },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
});
