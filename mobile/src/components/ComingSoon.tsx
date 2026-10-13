import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '@/constants/theme';
import { AppText } from './AppText';
import { EmptyState } from './EmptyState';

/** A tab whose feature is planned but not built yet: it says so plainly instead of pretending to work. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <EmptyState title="Coming soon" description={description} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });
