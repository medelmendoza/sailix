import { useNavigation } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import {
  AppText,
  Button,
  Card,
  CourseImage,
  ErrorState,
  FormError,
  Notice,
  SkeletonList,
} from '@/components';
import { colors, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import type { TalaMaterialSummary } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';
import { fetchTalaMaterial, useTalaCourse } from './api';
import { deleteDownload, downloadMaterial, listDownloads } from './offline/downloads';
import { pendingCompletions, queueCompletion, syncOutbox } from './offline/outbox';
import { savedCopyText } from './TalaCourseList';
import { TalaCourseProgress } from './TalaCourseProgress';
import { TalaFeedbackModal } from './TalaFeedbackModal';
import { isDone } from './materials';
import { TalaMaterialRow } from './TalaMaterialRow';
import { dueInfo } from './stats';
import type { Feedback } from './offline/outbox';

type Props = NativeStackScreenProps<AppStackParamList, 'TalaCourse'>;

export { materialStatsLine, statusWord } from './materials';

export function TalaCourseScreen({ route }: Props) {
  const { assignId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();
  const course = useTalaCourse(assignId);
  const downloads = useQuery({ queryKey: scopedKey('tala', 'downloads'), queryFn: listDownloads });
  const outbox = useQuery({ queryKey: scopedKey('tala', 'outbox'), queryFn: pendingCompletions });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<TalaMaterialSummary | null>(null);

  const refreshLocal = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'downloads') }),
      queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'outbox') }),
    ]);

  async function guarded(id: string, work: () => Promise<void>) {
    setError(null);
    setBusy(id);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error && !('kind' in e) ? e.message : describeError(e));
    } finally {
      setBusy(null);
    }
  }

  const openOnline = (m: TalaMaterialSummary) =>
    guarded(m.id, async () => {
      const detail = await fetchTalaMaterial(assignId, m.id);
      if (!detail.file_url) throw new Error('This item has no file to open.');
      await Linking.openURL(detail.file_url);
    });

  const download = (m: TalaMaterialSummary) =>
    guarded(m.id, async () => {
      await downloadMaterial(assignId, { id: m.id, type: m.type as 'video' | 'pdf', name: m.name });
      await refreshLocal();
    });

  const remove = (m: TalaMaterialSummary) =>
    guarded(m.id, async () => {
      await deleteDownload(m.id);
      await refreshLocal();
    });

  const completeWith = (m: TalaMaterialSummary, feedback?: Feedback) =>
    guarded(m.id, async () => {
      await queueCompletion(assignId, m.id, feedback);
      await refreshLocal();
      await syncOutbox(); // delivers now when online, otherwise stays queued
      await refreshLocal();
    });

  // A video needs feedback (rating + comment) to count as completed, as in the Tala app; a PDF does not.
  const markCompleted = (m: TalaMaterialSummary) => {
    if (m.type === 'video') setFeedbackFor(m);
    else void completeWith(m);
  };

  const syncNow = () =>
    guarded('sync', async () => {
      const r = await syncOutbox();
      await refreshLocal();
      if (r.stopped === 'offline')
        throw new Error('Still offline. It will be sent when you are back online.');
      if (r.stopped === 'relink')
        throw new Error('Link your Tala account again to send your progress.');
      if (r.stopped === 'disabled') throw new Error('Sending progress is not enabled.');
    });

  if (course.isPending) return <SkeletonList />;
  if (course.isError) {
    return (
      <ErrorState message={describeError(course.error)} onRetry={() => void course.refetch()} />
    );
  }
  const c = course.data.data;
  const pending = new Set(
    (outbox.data ?? []).filter((p) => p.assignId === assignId).map((p) => p.materialId),
  );
  const downloaded = downloads.data ?? {};

  function openOffline(m: TalaMaterialSummary) {
    const rec = downloaded[m.id];
    if (!rec) return;
    if (m.type === 'pdf') navigation.navigate('TalaPdf', { name: m.name, uri: rec.uri });
    else {
      navigation.navigate('TalaVideo', {
        name: m.name,
        uri: rec.uri,
        assignId,
        materialId: m.id,
        canComplete: c.progress_submission && !isDone(m),
      });
    }
  }

  function openMaterial(m: TalaMaterialSummary) {
    if (m.type === 'flashcards') {
      navigation.navigate('TalaFlashcards', { assignId, cardId: m.id, name: m.name });
    } else if (m.type === 'quiz') {
      navigation.navigate('TalaQuiz', { assignId, quizId: m.id, name: m.name });
    } else if (downloaded[m.id]) {
      openOffline(m);
    } else {
      void openOnline(m);
    }
  }

  const due = dueInfo(c);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* the course picture, full width, as in the original app */}
      <CourseImage uri={c.thumbnail_url} title={c.name} style={styles.hero} />

      <View style={styles.content}>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="title" accessibilityRole="header" style={styles.courseName}>
            {c.name}
          </AppText>
          <AppText>Creator : {c.creator ?? 'Unknown'}</AppText>
          {due ? (
            <AppText>
              Due : {due.text}
              {due.tone !== 'done' && c.date_to ? ` (${c.date_to})` : ''}
            </AppText>
          ) : null}
          <TalaCourseProgress course={c} showDue={false} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Description
          </AppText>
          <AppText muted={!c.description}>{c.description ?? 'No description.'}</AppText>
        </Card>

        {course.data.fromCache ? <Notice message={savedCopyText(course.data.fetchedAt)} /> : null}
        <Notice
          message={
            c.progress_submission
              ? 'Videos and documents are marked completed by you and are not checked. Quiz scores and flashcard results are recorded in Tala.'
              : 'You can view your courses here. Taking quizzes and recording progress is not available in this version of the app.'
          }
        />
        {pending.size > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText>
              {pending.size} completion{pending.size === 1 ? '' : 's'} waiting to be sent.
            </AppText>
            <Button
              title="Send now"
              variant="secondary"
              loading={busy === 'sync'}
              onPress={() => void syncNow()}
            />
          </Card>
        ) : null}
        <FormError message={error} />

        <Card style={{ gap: spacing.xs }}>
          <AppText variant="heading" accessibilityRole="header">
            Materials
          </AppText>
          {c.materials.length === 0 ? <AppText muted>No materials yet.</AppText> : null}
          {c.materials.map((m, i) => (
            <View key={m.id} style={i > 0 ? styles.divider : undefined}>
              <TalaMaterialRow
                m={m}
                saved={downloaded[m.id]}
                waiting={pending.has(m.id)}
                busy={busy === m.id}
                canMarkCompleted={
                  c.progress_submission &&
                  (m.type === 'video' || m.type === 'pdf') &&
                  m.viewable &&
                  !(isDone(m) || pending.has(m.id))
                }
                onOpen={() => openMaterial(m)}
                onDownload={() => void download(m)}
                onRemove={() => void remove(m)}
                onMarkCompleted={() => markCompleted(m)}
              />
            </View>
          ))}
          {c.hidden_materials > 0 ? (
            <AppText variant="caption" muted>
              {c.hidden_materials} item(s) in this course are not supported in this version of the
              app.
            </AppText>
          ) : null}
        </Card>
      </View>

      <TalaFeedbackModal
        visible={feedbackFor !== null}
        title={feedbackFor?.name ?? ''}
        onCancel={() => setFeedbackFor(null)}
        onSubmit={(feedback) => {
          const m = feedbackFor;
          setFeedbackFor(null);
          if (m) void completeWith(m, feedback);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  hero: { width: '100%', height: 260 },
  content: { padding: spacing.lg, gap: spacing.lg },
  courseName: { fontSize: 22, lineHeight: 28 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
});
