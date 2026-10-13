import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, FormError } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { HomeTodos } from '@/features/todos/HomeTodos';
import { HomeAnnouncements } from '@/features/announcements/HomeAnnouncements';
import { TalaLearningSummary } from '@/features/modules/tala/TalaLearningSummary';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const refreshMe = useSessionStore((s) => s.refreshMe);
  const switchError = useSessionStore((s) => s.switchError);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshMe();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe]);

  if (!me) return null;
  const name = me.profile?.first_name ?? me.user.display_name ?? me.user.username;

  return (
    <ScrollView
      testID="home-scroll"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title" accessibilityRole="header">
          Hello, {name}
        </AppText>
        <AppText muted>{me.tenant.name}</AppText>
      </View>
      <FormError
        message={error ?? (switchError ? `Could not switch organization. ${switchError}` : null)}
      />
      <HomeTodos />
      <HomeAnnouncements onSeeAll={() => navigation.navigate('Announcements')} />
      {me.modules.some((m) => m.code === 'tala' && m.enabled && m.status === 'linked') ? (
        <TalaLearningSummary />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });
