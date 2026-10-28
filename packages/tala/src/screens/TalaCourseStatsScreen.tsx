import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTalaCourse } from '../data/api';
import { describeError } from '../errors';
import type { TalaRoutes } from '../routes';
import { AppText, Card, ErrorState, Notice, SkeletonList } from '../ui';
import { spacing } from '../ui/theme';
import { savedCopyText } from './TalaCourseList';
import { TalaCourseProgress } from './TalaCourseProgress';
import { materialStatsLine, statusWord, TYPE_LABEL } from './materials';

type Props = NativeStackScreenProps<TalaRoutes, 'TalaCourseStats'>;

/**
 * What is recorded for one course in Tala: the course summary and, for each item, its status and what the learner achieved
 * (a video's rating, a quiz's score, how the flashcards were rated). Read-only: nothing here opens an item; to watch,
 * take a quiz or study, use My Courses.
 */
export function TalaCourseStatsScreen({ route }: Props) {
  const { assignId } = route.params;
  const query = useTalaCourse(assignId);
  if (query.isPending) return <SkeletonList />;
  if (query.isError) {
    return <ErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />;
  }
  const c = query.data.data;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {query.data.fromCache ? <Notice message={savedCopyText(query.data.fetchedAt)} /> : null}
      <Card variant="flat" style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">
          {c.name}
        </AppText>
        {c.creator ? (
          <AppText variant="caption" muted>
            Creator: {c.creator}
          </AppText>
        ) : null}
        <TalaCourseProgress course={c} showPercent />
        {c.description ? <AppText muted>{c.description}</AppText> : null}
      </Card>

      <AppText variant="heading">Items</AppText>
      {c.materials.length === 0 ? <AppText muted>This course has no items to show.</AppText> : null}
      {c.materials.map((m) => {
        const status = statusWord(m.status);
        const line = materialStatsLine(m);
        return (
          <Card key={m.id} variant="flat" style={styles.card}>
            <AppText style={styles.name}>{m.name}</AppText>
            <View style={styles.meta}>
              <AppText variant="caption" muted>
                {TYPE_LABEL[m.type] ?? m.type}
                {status ? ` · ${status}` : ' · Not completed'}
              </AppText>
            </View>
            {line ? <AppText variant="caption">{line}</AppText> : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.xs },
  meta: { flexDirection: 'row' },
  name: { fontFamily: 'Nunito_700Bold' },
});
