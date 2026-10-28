import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { useBrand } from './brand';
import { Card } from './Card';
import { GlyphIcon, type GlyphName } from './GlyphIcon';
import { spacing } from './theme';

/** Every dashboard tile is this tall, so the dashboard reads as an even grid; what does not fit scrolls inside the tile. */
export const DASHLET_HEIGHT = 350;

/** A dashboard tile: an icon chip, a title and a one-line subtitle, then the content (which scrolls if it is long). */
export function Dashlet({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: GlyphName;
  children: ReactNode;
}) {
  const brand = useBrand();
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.chip, { backgroundColor: brand.infoBg }]}>
          <GlyphIcon name={icon} color={brand.primary} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" muted>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
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
  card: { height: DASHLET_HEIGHT, gap: spacing.md, padding: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xs },
});
