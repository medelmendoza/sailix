import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, ErrorState, SkeletonList, TabIcon } from '@/components';
import { colors, spacing } from '@/constants/theme';
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
      <Card variant="flat" style={styles.card}>
        <View style={styles.meta}>
          <View style={styles.bell}>
            <TabIcon name="bell" color={colors.primary} />
          </View>
          <AppText variant="caption" muted>
            Announcement · {ageLabel(one.data.created_at)}
          </AppText>
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {one.data.title}
        </AppText>
        <View style={styles.rule} />
        <AppText selectable style={styles.body}>
          {one.data.body}
        </AppText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  card: { gap: spacing.lg, padding: spacing.xl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  title: { fontSize: 26, lineHeight: 34 },
  rule: { height: 2, borderRadius: 1, backgroundColor: colors.seafoam },
  body: { fontSize: 17, lineHeight: 28 },
});
