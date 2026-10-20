import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, LinkButton, SkeletonList, TabIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { AnnouncementCard } from './AnnouncementCard';
import { useAnnouncements } from './api';
import { useBrand } from '@/theme/brand';

/**
 * The announcements card of the old Sailix dashboard: a title with a bell that opens the Announcements tab, a green
 * rule, then the latest announcements (or a plain "none yet"). A load failure shows nothing rather than an error box.
 */
export function HomeAnnouncements({ onOpenAll }: { onOpenAll: () => void }) {
  const brand = useBrand();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const list = useAnnouncements();
  const latest = list.data?.pages[0]?.data.slice(0, 3) ?? [];
  const unread = list.data?.pages[0]?.unread_count ?? 0;
  if (list.isError) return null;

  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          Announcements
        </AppText>
        {unread > 0 ? (
          <View
            style={[styles.count, { backgroundColor: brand.primary }]}
            accessible
            accessibilityLabel={`${unread} new`}
          >
            <AppText variant="caption" style={{ color: colors.onPrimary }}>
              {unread} new
            </AppText>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open announcements"
          onPress={onOpenAll}
          hitSlop={8}
          style={styles.bell}
        >
          <TabIcon name="announce" color={brand.primary} />
        </Pressable>
      </View>
      <View style={styles.rule} />
      {list.isPending ? (
        <SkeletonList />
      ) : latest.length === 0 ? (
        <AppText muted>No announcements yet.</AppText>
      ) : (
        <>
          {latest.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              flat
              onPress={() => navigation.navigate('Announcement', { id: a.id })}
            />
          ))}
          <LinkButton title="See all announcements" onPress={onOpenAll} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  bell: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { height: 2, borderRadius: 1, backgroundColor: colors.seafoam },
});
