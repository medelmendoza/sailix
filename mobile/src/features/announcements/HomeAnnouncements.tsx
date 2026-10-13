import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button } from '@/components';
import { spacing } from '@/constants/theme';
import { AnnouncementCard } from './AnnouncementCard';
import { useAnnouncements } from './api';

/**
 * Home card: the latest announcements. Like the learning summary it never gets in the way of the rest of Home: while
 * loading, on an error, or when there is nothing, it renders nothing.
 */
export function HomeAnnouncements({ onSeeAll }: { onSeeAll: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const list = useAnnouncements();
  const latest = list.data?.pages[0]?.data.slice(0, 3) ?? [];
  const unread = list.data?.pages[0]?.unread_count ?? 0;
  if (latest.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <AppText variant="heading" accessibilityRole="header">
        Announcements{unread > 0 ? ` (${unread} new)` : ''}
      </AppText>
      {latest.map((a) => (
        <AnnouncementCard
          key={a.id}
          announcement={a}
          onPress={() => navigation.navigate('Announcement', { id: a.id })}
        />
      ))}
      <Button title="See all announcements" variant="secondary" onPress={onSeeAll} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.md } });
