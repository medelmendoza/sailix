import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { spacing } from './theme';

/** Every dashboard tile is this tall, so the dashboard reads as an even grid; what does not fit scrolls inside the tile. */
export const DASHLET_HEIGHT = 360;

export function Dashlet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="flat" style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={styles.body}
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { height: DASHLET_HEIGHT, gap: spacing.md },
  body: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xs },
});
