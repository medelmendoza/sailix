import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, EmptyState, Notice, Screen } from '@/components';
import { colors, spacing } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';
import { isModuleContentAvailable, STATUS_DESCRIPTION, STATUS_LABEL } from './availability';

type Props = NativeStackScreenProps<AppStackParamList, 'Module'>;

/**
 * Module entry. It shows only what the API says about the caller's access (`/me.modules`). Content and linking
 * arrive with the Sailix gateway (M3); until then this screen says so plainly instead of faking data.
 */
export function ModuleScreen({ route }: Props) {
  const me = useSessionStore((s) => s.me);
  const module = me?.modules.find((m) => m.code === route.params.code);

  if (!module) {
    return (
      <Screen>
        <EmptyState
          title="Service not available"
          description="This service is not available for your account."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <AppText variant="title" accessibilityRole="header">
          {module.label}
        </AppText>
        <Card>
          <AppText variant="caption" style={{ color: colors.textMuted }}>
            Status
          </AppText>
          <AppText variant="heading">{STATUS_LABEL[module.status] ?? module.status}</AppText>
          <AppText muted>{STATUS_DESCRIPTION[module.status] ?? ''}</AppText>
        </Card>
        {!isModuleContentAvailable(module.code) && module.enabled ? (
          <Notice
            message={`${module.label} courses and account linking are not available in this version of the app yet.`}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.lg } });
