import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, FormError, Notice, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import type { TalaMaterialSummary } from '@/services/api/types';
import { fetchTalaMaterial, useTalaCourse } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'TalaCourse'>;

const TYPE_LABEL: Record<string, string> = { video: 'Video', pdf: 'PDF', quiz: 'Quiz' };

export function TalaCourseScreen({ route }: Props) {
  const { assignId } = route.params;
  const course = useTalaCourse(assignId);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function open(material: TalaMaterialSummary) {
    setError(null);
    setOpening(material.id);
    try {
      const detail = await fetchTalaMaterial(assignId, material.id);
      if (!detail.file_url) {
        setError('This item has no file to open.');
        return;
      }
      await Linking.openURL(detail.file_url);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setOpening(null);
    }
  }

  if (course.isPending) return <SkeletonList />;
  if (course.isError) {
    return (
      <ErrorState message={describeError(course.error)} onRetry={() => void course.refetch()} />
    );
  }
  const c = course.data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {c.name}
      </AppText>
      {c.description ? <AppText muted>{c.description}</AppText> : null}
      <Notice message="You can view your courses here. Taking quizzes and recording progress is not available in this version of the app." />
      <FormError message={error} />
      {c.materials.map((m) => (
        <Card key={m.id} style={{ gap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText variant="heading">{m.name}</AppText>
            <AppText variant="caption" muted>
              {TYPE_LABEL[m.type] ?? m.type}
              {m.progress ? ` · ${m.progress}%` : ''}
              {m.status ? ` · ${m.status}` : ''}
            </AppText>
          </View>
          {m.viewable ? (
            <Button
              title={m.type === 'video' ? 'Watch' : 'Open'}
              variant="secondary"
              loading={opening === m.id}
              onPress={() => void open(m)}
            />
          ) : (
            <AppText muted>Quizzes are not available in this version.</AppText>
          )}
        </Card>
      ))}
      {c.hidden_materials > 0 ? (
        <AppText variant="caption" muted>
          {c.hidden_materials} item(s) in this course are not supported in this version of the app.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });
