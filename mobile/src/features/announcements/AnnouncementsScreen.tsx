import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Button, EmptyState, ErrorState, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { AnnouncementCard } from './AnnouncementCard';
import { useAnnouncements } from './api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Announcements'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function AnnouncementsScreen({ navigation }: Props) {
  const list = useAnnouncements();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await list.refetch();
    setRefreshing(false);
  }

  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <AppText variant="title" accessibilityRole="header">
        Announcements
      </AppText>
      {list.isPending ? (
        <SkeletonList />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No announcements"
          description="Messages from your organization will appear here."
        />
      ) : (
        <>
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onPress={() => navigation.navigate('Announcement', { id: a.id })}
            />
          ))}
          {list.hasNextPage ? (
            <Button
              title="Load more"
              variant="secondary"
              loading={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });
