import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onTabScroll } from '@/app/navigation/tabBarCollapse';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, FormError, GlyphIcon, TabIcon } from '@/components';
import { colors, gradients, minTouchTarget, spacing } from '@/constants/theme';
import { HomeAnnouncements } from '@/features/announcements/HomeAnnouncements';
import { useUnreadCount } from '@/features/announcements/api';
import { useDocuments } from '@/features/files/api';
import { useNextTodos } from '@/features/todos/api';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { QuickActions, TodayCard } from './HomeShortcuts';

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
 * The Sailix dashboard: the blue-to-teal header (greeting, your name, the organization and your initials), a Today card
 * that overlaps it with live counters, four round shortcuts, and the latest announcements.
 * Nothing here belongs to a service such as Tala: services live under the Services tab.
 */
export function HomeScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const refreshMe = useSessionStore((s) => s.refreshMe);
  const switchError = useSessionStore((s) => s.switchError);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todos = useNextTodos();
  const docs = useDocuments('approved');
  const unread = useUnreadCount(true);

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
  const newCount = unread.data ?? 0;

  return (
    <ScrollView
      testID="home-scroll"
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" style={styles.white}>
            {greeting(new Date().getHours())}
          </AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.white}>
            {name}
          </AppText>
          <AppText variant="caption" style={[styles.white, { opacity: 0.9 }]}>
            {me.tenant.name}
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
        <TodayCard
          counters={[
            {
              title: 'To-do list',
              note: todoNote,
              big: todos.data ? String(open) : '–',
              line: !todos.data
                ? ''
                : overdue > 0
                  ? `${overdue} overdue`
                  : open === 0
                    ? 'All done'
                    : 'On track',
              ink: !todos.data
                ? colors.textMuted
                : overdue > 0
                  ? colors.danger
                  : open === 0
                    ? colors.success
                    : colors.primary,
              bg: !todos.data
                ? colors.surfaceSunken
                : overdue > 0
                  ? colors.dangerBg
                  : open === 0
                    ? colors.successBg
                    : colors.infoBg,
              icon: <GlyphIcon name="check" color={colors.primary} size={22} />,
              onPress: () => navigation.navigate('Todos'),
            },
            {
              title: 'Documents',
              note: docNote,
              big: counts ? String(expired + expiring) : '–',
              line: !counts
                ? ''
                : expired + expiring === 0
                  ? 'All valid'
                  : [
                      expired > 0 ? `${expired} expired` : null,
                      expiring > 0 ? `${expiring} expiring` : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
              ink: !counts
                ? colors.textMuted
                : expired > 0
                  ? colors.danger
                  : expiring > 0
                    ? colors.warning
                    : colors.success,
              bg: !counts
                ? colors.surfaceSunken
                : expired > 0
                  ? colors.dangerBg
                  : expiring > 0
                    ? colors.warningBg
                    : colors.successBg,
              icon: <GlyphIcon name="pdf" color={colors.primary} size={22} />,
              onPress: () => navigation.navigate('Files'),
            },
            {
              title: 'Notices',
              note: newCount > 0 ? `${newCount} new` : null,
              big: unread.data === undefined ? '–' : String(newCount),
              line: unread.data === undefined ? '' : newCount > 0 ? 'new' : 'All read',
              ink: newCount > 0 ? colors.primary : colors.textMuted,
              bg: newCount > 0 ? colors.infoBg : colors.surfaceSunken,
              icon: <TabIcon name="announce" color={colors.primary} />,
              onPress: () => navigation.navigate('Announcements'),
            },
          ]}
        />
        <QuickActions
          onUpload={() => navigation.navigate('DocumentForm', {})}
          onScan={() => navigation.navigate('Scanner')}
          onFinance={() => navigation.navigate('Finance')}
          onServices={() => navigation.navigate('Services')}
        />
        <HomeAnnouncements onOpenAll={() => navigation.navigate('Announcements')} />
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
    paddingBottom: spacing.xxxl + spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.header,
  },
  white: { color: colors.onPrimary },
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
  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.xxxl },
});
