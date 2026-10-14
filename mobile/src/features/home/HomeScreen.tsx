import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, FormError, GlyphIcon, TabIcon } from '@/components';
import { colors, gradients, minTouchTarget, spacing } from '@/constants/theme';
import { HomeAnnouncements } from '@/features/announcements/HomeAnnouncements';
import { useDocuments } from '@/features/files/api';
import { useNextTodos } from '@/features/todos/api';
import { describeError } from '@/services/api/errors';
import { useSessionStore } from '@/store/sessionStore';
import { ShortcutsCard, Tile } from './HomeShortcuts';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

/**
 * The Sailix dashboard, as in the original app: a blue-to-green header ("Welcome," and your first name), a card of round
 * shortcuts, two tiles (To-do list, Documents) and the announcements card. Nothing here belongs to a service such as Tala:
 * services live under the Services tab.
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
  const docNote =
    counts && (counts.expired > 0 || counts.expiring > 0)
      ? [
          counts.expired > 0 ? `${counts.expired} expired` : null,
          counts.expiring > 0 ? `${counts.expiring} expiring soon` : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

  return (
    <ScrollView
      testID="home-scroll"
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={styles.welcome}>
            Welcome,
          </AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.name}>
            {name}
          </AppText>
          <AppText variant="caption" style={styles.org}>
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
          <GlyphIcon name="person" color={colors.onPrimary} size={26} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <FormError
          message={error ?? (switchError ? `Could not switch organization. ${switchError}` : null)}
        />
        <ShortcutsCard
          onUpload={() => navigation.navigate('DocumentForm', {})}
          onFinance={() => navigation.navigate('Finance')}
          onServices={() => navigation.navigate('Services')}
        />
        <View style={styles.tiles}>
          <Tile
            title="To-do list"
            note={todoNote}
            noteColor={overdue > 0 ? colors.danger : colors.textMuted}
            icon={<GlyphIcon name="check" color={colors.primary} size={26} />}
            onPress={() => navigation.navigate('Todos')}
          />
          <Tile
            title="Documents"
            note={docNote}
            noteColor={counts?.expired ? colors.danger : colors.warning}
            icon={<TabIcon name="folder" color={colors.primary} />}
            onPress={() => navigation.navigate('Files')}
          />
        </View>
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
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.header,
  },
  welcome: { color: colors.onPrimary },
  name: { color: colors.onPrimary },
  org: { color: colors.onPrimary, opacity: 0.9 },
  account: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.lg, gap: spacing.lg },
  tiles: { flexDirection: 'row', gap: spacing.md },
});
