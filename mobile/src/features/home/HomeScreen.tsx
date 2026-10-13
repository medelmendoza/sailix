import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Card, EmptyState, FormError } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import type { MyModule } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';
import { HomeAnnouncements } from '@/features/announcements/HomeAnnouncements';
import { STATUS_LABEL } from '@/features/modules/availability';
import { TalaLearningSummary } from '@/features/modules/tala/TalaLearningSummary';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

const STATUS_COLOR: Record<string, string> = {
  linked: colors.success,
  not_linked: colors.accent,
  needs_relink: colors.warning,
  disabled: colors.textMuted,
  revoked: colors.danger,
};

function ModuleCard({ module, onPress }: { module: MyModule; onPress: () => void }) {
  const label = STATUS_LABEL[module.status] ?? module.status;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${module.label}, ${label}`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Card style={styles.moduleCard}>
        <View style={styles.moduleText}>
          <AppText variant="heading">{module.label}</AppText>
          <AppText variant="caption" style={{ color: STATUS_COLOR[module.status] ?? colors.text }}>
            {label}
          </AppText>
        </View>
        <AppText muted>›</AppText>
      </Card>
    </Pressable>
  );
}

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
      <HomeAnnouncements onSeeAll={() => navigation.navigate('Announcements')} />
      {me.modules.some((m) => m.code === 'tala' && m.enabled && m.status === 'linked') ? (
        <TalaLearningSummary />
      ) : null}
      <AppText variant="heading">Services</AppText>
      {me.modules.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Your organization has not made any services available to you."
        />
      ) : (
        me.modules.map((m) => (
          <ModuleCard
            key={m.code}
            module={m}
            onPress={() => navigation.navigate('Module', { code: m.code })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget,
    borderRadius: radius.md,
  },
  moduleText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
