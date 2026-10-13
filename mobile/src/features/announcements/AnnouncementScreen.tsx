import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, ErrorState, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import { ageLabel } from './age';
import { useAnnouncement, useMarkRead } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'Announcement'>;

/** Opening an unread announcement marks it read. The text is shown as plain text, never interpreted. */
export function AnnouncementScreen({ route }: Props) {
  const { id } = route.params;
  const one = useAnnouncement(id);
  const markRead = useMarkRead();
  const needsMark = one.data?.is_read === false;

  useEffect(() => {
    if (needsMark) void markRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once per opening, not when the helper's identity changes
  }, [needsMark, id]);

  if (one.isError) {
    const gone = toApiError(one.error).status === 404;
    return (
      <ErrorState
        message={gone ? 'This announcement is no longer available.' : describeError(one.error)}
        onRetry={gone ? undefined : () => void one.refetch()}
      />
    );
  }
  if (!one.data) return <SkeletonList />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {one.data.title}
      </AppText>
      <AppText variant="caption" muted>
        {ageLabel(one.data.created_at)}
      </AppText>
      <AppText selectable>{one.data.body}</AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md } });
