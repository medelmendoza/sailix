import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onTabScroll } from '@/app/navigation/tabBarCollapse';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, FormError, GlyphIcon, TabIcon } from '@/components';
import { colors, gradients, minTouchTarget, spacing } from '@/constants/theme';
import { HomeAnnouncements } from '@/features/announcements/HomeAnnouncements';
import { useDocuments } from '@/features/files/api';
import { useNextTodos } from '@/features/todos/api';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { useFeature } from '@/store/featureAccess';
import { QuickActions, Tile } from './HomeShortcuts';
import { useBrand, useLogoUrl, useShortName } from '@/theme/brand';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

/** "Good morning", "Good afternoon" or "Good evening" by the phone's own clock. */
export function greeting(hour: number): string {
  return hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
}

/** Up to two capital letters for the round badge: first and last name, or the start of the username. */
export function initials(first?: string | null, last?: string | null, fallback = ''): string {
  const a = first?.trim()[0];
  const b = last?.trim()[0];
  if (a && b) return `${a}${b}`.toUpperCase();
  if (a) return a.toUpperCase();
  return fallback.slice(0, 2).toUpperCase();
}

/**
 * The Sailix dashboard: the blue-to-teal header (greeting, your name, the organization and your initials),
 * the three round shortcuts, the To-do list and Documents tiles, and the latest announcements.
 * Nothing here belongs to a service such as Tala: services live under the Services tab.
 */
export function HomeScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const refreshMe = useSessionStore((s) => s.refreshMe);
  const switchError = useSessionStore((s) => s.switchError);
  const insets = useSafeAreaInsets();
  const brand = useBrand();
  const logo = useLogoUrl();
  const orgName = useShortName(me?.tenant.name ?? '');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTodos = useFeature('todos');
  const hasDocuments = useFeature('documents');
  const hasFinance = useFeature('finance');
  const hasAnnouncements = useFeature('announcements');
  const todos = useNextTodos(hasTodos);
  const docs = useDocuments('approved', hasDocuments);

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
  const badge = initials(me.profile?.first_name, me.profile?.last_name, me.user.username);

  const open = todos.data?.open_count ?? 0;
  const overdue = todos.data?.overdue_count ?? 0;
  const todoNote = todos.data
    ? open === 0
      ? 'All done'
      : overdue > 0
        ? `${open} open, ${overdue} overdue`
        : `${open} open`
    : null;
  const counts = docs.data?.counts;
  const expired = counts?.expired ?? 0;
  const expiring = counts?.expiring ?? 0;
  const docNote =
    counts && (expired > 0 || expiring > 0)
      ? [
          expired > 0 ? `${expired} expired` : null,
          expiring > 0 ? `${expiring} expiring soon` : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

  return (
    <ScrollView
      testID="home-scroll"
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View
        key={brand.gradients.header} // the gradient is rebuilt, not changed, when the look changes
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.lg },
          { backgroundColor: brand.primary, experimental_backgroundImage: brand.gradients.header },
        ]}
      >
        {logo ? (
          <Image
            source={{ uri: logo }}
            accessibilityLabel={`${me.tenant.name} logo`}
            resizeMode="contain"
            style={styles.logo}
          />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" style={styles.white}>
            {greeting(new Date().getHours())}
          </AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.white}>
            {name}
          </AppText>
          <AppText variant="caption" style={[styles.white, { opacity: 0.9 }]}>
            {orgName}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account"
          onPress={() => navigation.navigate('Account')}
          hitSlop={8}
          style={styles.account}
        >
          <AppText style={styles.initials} accessibilityElementsHidden>
            {badge}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.body}>
        <FormError
          message={error ?? (switchError ? `Could not switch organization. ${switchError}` : null)}
        />
        <QuickActions
          showUpload={hasDocuments}
          showFinance={hasFinance}
          onUpload={() => navigation.navigate('DocumentForm', {})}
          onFinance={() => navigation.navigate('Finance')}
          onServices={() => navigation.navigate('Services')}
        />
        {hasTodos || hasDocuments ? (
          <View style={styles.tiles}>
            {hasTodos ? (
              <Tile
                title="To-do list"
                note={todoNote}
                noteColor={overdue > 0 ? colors.danger : colors.textMuted}
                icon={<GlyphIcon name="check" size={26} />}
                onPress={() => navigation.navigate('Todos')}
              />
            ) : null}
            {hasDocuments ? (
              <Tile
                title="Documents"
                note={docNote}
                noteColor={expired > 0 ? colors.danger : colors.warning}
                icon={<TabIcon name="folder" color={brand.primary} />}
                onPress={() => navigation.navigate('Files')}
              />
            ) : null}
          </View>
        ) : null}
        {hasAnnouncements ? (
          <HomeAnnouncements onOpenAll={() => navigation.navigate('Announcements')} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.header,
  },
  white: { color: colors.onPrimary },
  logo: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  account: {
    width: 48,
    height: 48,
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  initials: { color: colors.onPrimary, fontFamily: 'Quicksand_700Bold', fontSize: 17 },
  body: { padding: spacing.lg, gap: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md },
});
