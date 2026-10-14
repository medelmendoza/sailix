import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Card, FormError, NavRow, type GlyphName } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { STATUS_LABEL } from '@/features/modules/availability';
import { describeError } from '@/services/api/errors';
import type { MyModule } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';
import { ServiceLogo, hasLogo } from './ServiceLogo';

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

const GLYPH: Record<string, GlyphName> = { tala: 'video', astra: 'target', callit: 'alert' };

const STATUS_COLOR: Record<string, string> = {
  linked: colors.success,
  not_linked: colors.accent,
  needs_relink: colors.warning,
  disabled: colors.textMuted,
  revoked: colors.danger,
};

function ServiceCard({ module, onPress }: { module: MyModule; onPress: () => void }) {
  const label = STATUS_LABEL[module.status] ?? module.status;
  return (
    <NavRow
      title={module.label}
      note={label}
      noteColor={STATUS_COLOR[module.status]}
      glyph={GLYPH[module.code] ?? 'cards'}
      icon={hasLogo(module.code) ? <ServiceLogo code={module.code} /> : undefined}
      accessibilityLabel={`${module.label}, ${label}`}
      onPress={onPress}
    />
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
});
