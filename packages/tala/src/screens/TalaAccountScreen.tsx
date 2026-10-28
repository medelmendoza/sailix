import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import type { TalaRoutes } from '../routes';
import { AppText, Button, Card } from '../ui';
import { spacing } from '../ui/theme';

/** The profile screen, opened from the profile button in the header: the account's team and what is not a tab. */
export function TalaAccountScreen({
  teamName,
  canSwitchTeam,
  onSwitchTeam,
  onSignOut,
  onExit,
}: {
  teamName: string | null;
  canSwitchTeam: boolean;
  onSwitchTeam: () => void;
  onSignOut: () => void;
  /** Present when a host app mounted Lodestar (Sailix); the standalone app has nowhere to go back to. */
  onExit?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">
          Your Lodestar account
        </AppText>
        {teamName ? <AppText muted>Team: {teamName}</AppText> : null}
      </Card>
      <Card style={styles.card}>
        <Button title="Join a course" variant="secondary" onPress={() => navigation.navigate('TalaJoinCourse')} />
        {canSwitchTeam ? <Button title="Switch team" variant="secondary" onPress={onSwitchTeam} /> : null}
      </Card>
      <Card style={styles.card}>
        <Button title="Sign out" variant="secondary" onPress={onSignOut} />
        {onExit ? <Button title="Back to Services" variant="secondary" onPress={onExit} /> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
});
