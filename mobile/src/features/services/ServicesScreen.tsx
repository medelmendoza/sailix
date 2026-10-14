import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Card, FormError, GlyphIcon, type GlyphName } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { STATUS_LABEL } from '@/features/modules/availability';
import { describeError } from '@/services/api/errors';
import type { MyModule } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Services'>,
  NativeStackScreenProps<AppStackParamList>
>;

/**
 * Services other BTSolve products offer inside Sailix that are planned but not built. They are listed so people know
 * more is coming; they cannot be opened. A service that exists in the server's registry replaces its entry here.
 */
const PLANNED = [
  { code: 'srt', label: 'SRT' },
  { code: 'callit', label: 'Call-it' },
  { code: 'astra', label: 'Astra' },
] as const;

const LOOK: Record<string, { glyph: GlyphName; gradient: string }> = {
  tala: { glyph: 'video', gradient: 'linear-gradient(135deg, #355DAD 0%, #2A7F8F 100%)' },
  astra: { glyph: 'target', gradient: 'linear-gradient(135deg, #2A7F8F 0%, #2E8B6A 100%)' },
  callit: { glyph: 'alert', gradient: 'linear-gradient(135deg, #A8391A 0%, #C2603A 100%)' },
};
const DEFAULT_LOOK = LOOK.tala!;

function ServiceCard({ module, onPress }: { module: MyModule; onPress: () => void }) {
  const label = STATUS_LABEL[module.status] ?? module.status;
  const look = LOOK[module.code] ?? DEFAULT_LOOK;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${module.label}, ${label}`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <View style={[styles.bold, { experimental_backgroundImage: look.gradient }]}>
        <View style={styles.badge}>
          <GlyphIcon name={look.glyph} color="#FFFFFF" size={30} />
        </View>
        <View style={styles.text}>
          <AppText variant="heading" style={styles.white}>
            {module.label}
          </AppText>
          <View style={styles.pill}>
            <AppText variant="caption" style={styles.white}>
              {label}
            </AppText>
          </View>
        </View>
        <AppText style={styles.white}>›</AppText>
      </View>
    </Pressable>
  );
}

function PlannedCard({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, coming soon`}
      accessibilityState={{ disabled: true }}
    >
      <Card variant="inset" style={styles.card}>
        <View style={styles.text}>
          <AppText variant="heading" muted>
            {label}
          </AppText>
          <AppText variant="caption" muted>
            Coming soon
          </AppText>
        </View>
      </Card>
    </View>
  );
}

export function ServicesScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const refreshMe = useSessionStore((s) => s.refreshMe);
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
  const known = new Set(me.modules.map((m) => m.code as string));
  const planned = PLANNED.filter((p) => !known.has(p.code));

  return (
    <ScrollView
      testID="services-scroll"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <AppText variant="title" accessibilityRole="header">
        Services
      </AppText>
      <AppText muted>Other services your organization offers through Sailix.</AppText>
      <FormError message={error} />
      {me.modules.length === 0 ? (
        <AppText muted>Your organization has not turned on any service yet.</AppText>
      ) : (
        me.modules.map((m) => (
          <ServiceCard
            key={m.code}
            module={m}
            onPress={() =>
              m.code === 'astra'
                ? navigation.navigate('AstraMenu')
                : m.code === 'callit'
                  ? navigation.navigate('CallIt')
                  : navigation.navigate('Module', { code: m.code })
            }
          />
        ))
      )}
      {planned.map((p) => (
        <PlannedCard key={p.code} label={p.label} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  white: { color: '#FFFFFF' },
  bold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 104,
    padding: spacing.xl,
    borderRadius: 24,
    boxShadow: '0 6px 16px rgba(18, 36, 61, 0.22)',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
