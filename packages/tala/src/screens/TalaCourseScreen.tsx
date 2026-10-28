import { useNavigation } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { TalaRoutes } from '../routes';
import { AppText, Button, Card, ErrorState, FormError, Notice } from '../ui';
import { colors, radius, spacing } from '../ui/theme';
import { describeError } from '../errors';
import type { TalaMaterialSummary } from '../types';
import { scopedKey } from '../runtime';
import { useTalaCourse } from '../data/api';
import { deleteDownload, downloadMaterial, listDownloads, markOpened } from '../offline/downloads';
import { pendingCompletions, queueCompletion, syncOutbox } from '../offline/outbox';
import { savedCopyText } from './TalaCourseList';
import { TalaCourseHeader } from './TalaCourseHeader';
import { TalaHowItWorks } from './TalaHowItWorks';
import { isDone } from './materials';
import { TalaMaterialRow } from './TalaMaterialRow';
import { CourseDetailSkeleton } from './TalaSkeletons';
import { useBrand } from '../ui/brand';

type Props = NativeStackScreenProps<TalaRoutes, 'TalaCourse'>;

export { materialStatsLine, statusWord } from './materials';

export function TalaCourseScreen({ route }: Props) {
  const brand = useBrand();
  const { assignId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<TalaRoutes>>();
  const queryClient = useQueryClient();
  const course = useTalaCourse(assignId);
  const downloads = useQuery({ queryKey: scopedKey('tala', 'downloads'), queryFn: listDownloads });
  const outbox = useQuery({ queryKey: scopedKey('tala', 'outbox'), queryFn: pendingCompletions });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; written: number; total: number } | null>(
    null,
  );
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef({ content: 0, list: 0, items: {} as Record<string, number> });

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

  const download = (m: TalaMaterialSummary) => {
    const controller = new AbortController();
    abort.current = controller;
    let lastPercent = -1;
    setProgress({ id: m.id, written: 0, total: -1 });
    return guarded(m.id, async () => {
      try {
        await downloadMaterial(
          assignId,
          { id: m.id, type: m.type as 'video' | 'pdf', name: m.name },
          {
            signal: controller.signal,
            onProgress: ({ bytesWritten, totalBytes }) => {
              // repaint only when the percentage moves (or once, when the size is unknown)
              const percent = totalBytes > 0 ? Math.floor((bytesWritten / totalBytes) * 100) : -1;
              if (percent === lastPercent && percent !== -1) return;
              lastPercent = percent;
              setProgress({ id: m.id, written: bytesWritten, total: totalBytes });
            },
          },
        );
        await refreshLocal();
      } catch (e) {
        if (!controller.signal.aborted) throw e; // a cancel is not an error
      } finally {
        abort.current = null;
        setProgress(null);
      }
    });
  };

  const remove = (m: TalaMaterialSummary) =>
    guarded(m.id, async () => {
      await deleteDownload(m.id);
      await refreshLocal();
    });

  const completeWith = (m: TalaMaterialSummary) =>
    guarded(m.id, async () => {
      await queueCompletion(assignId, m.id);
      await refreshLocal();
      await syncOutbox(); // delivers now when online, otherwise stays queued
      await refreshLocal();
    });

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

  if (course.isPending) return <CourseDetailSkeleton />;
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
  // an ordered course: a material opens only when every one before it is completed (or waiting to be sent)
  const lockedBy = new Map<string, string>();
  if (c.sequential) {
    let blocker: string | null = null;
    for (const m of c.materials) {
      if (blocker) lockedBy.set(m.id, blocker);
      else if (m.viewable && !(isDone(m) || pending.has(m.id))) blocker = m.name;
    }
  }

  // the next material to do: the first one that is open and not yet completed
  const next = c.materials.find(
    (m) => m.viewable && !lockedBy.has(m.id) && !(isDone(m) || pending.has(m.id)),
  );
  const goToNext = () => {
    if (!next) return;
    const o = offsets.current;
    scroller.current?.scrollTo({
      y: Math.max(0, o.content + o.list + (o.items[next.id] ?? 0) - spacing.lg),
      animated: true,
    });
  };

  function openOffline(m: TalaMaterialSummary) {
    const rec = downloaded[m.id];
    if (!rec) return;
    if (m.type === 'pdf') {
      void markOpened(m.id).then(refreshLocal); // opening it is what lets the learner mark it completed
      navigation.navigate('TalaPdf', { name: m.name, uri: rec.uri });
    } else {
      navigation.navigate('TalaVideo', {
        name: m.name,
        uri: rec.uri,
        assignId,
        materialId: m.id,
        canComplete: c.progress_submission && !isDone(m) && !pending.has(m.id),
        completed: isDone(m) || pending.has(m.id),
      });
    }
  }

  /** Quizzes and flashcards open directly; a video or a PDF must be downloaded first (it is then played from the device). */
  function openMaterial(m: TalaMaterialSummary) {
    if (lockedBy.has(m.id)) return;
    if (m.type === 'flashcards') {
      navigation.navigate('TalaFlashcards', { assignId, cardId: m.id, name: m.name });
    } else if (m.type === 'quiz') {
      navigation.navigate('TalaQuiz', { assignId, quizId: m.id, name: m.name });
    } else if (downloaded[m.id]) {
      openOffline(m);
    } else {
      void download(m);
    }
  }

  return (
    <ScrollView ref={scroller} contentContainerStyle={styles.scroll}>
      <TalaCourseHeader
        c={c}
        saved={c.materials.filter((m) => Boolean(downloaded[m.id])).length}
        next={next?.name ?? null}
        onContinue={goToNext}
      />

      <View
        style={styles.content}
        onLayout={(e) => (offsets.current.content = e.nativeEvent.layout.y)}
      >
        {course.data.fromCache ? <Notice message={savedCopyText(course.data.fetchedAt)} /> : null}
        {c.progress_submission ? (
          <TalaHowItWorks message="Download a video or a document to open it. A video is completed after you watch it and send your feedback. Quiz scores and flashcard results are recorded in Tala." />
        ) : (
          <Notice message="You can view your courses here. Taking quizzes and recording progress is not available in this version of the app." />
        )}
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

        <View
          style={{ gap: spacing.md }}
          onLayout={(e) => (offsets.current.list = e.nativeEvent.layout.y)}
        >
          <View style={styles.materialsHead}>
            <AppText variant="heading" accessibilityRole="header">
              Materials
            </AppText>
            <View style={[styles.count, { backgroundColor: brand.infoBg }]}>
              <AppText variant="caption" style={{ color: brand.primary }}>
                {c.materials.filter((m) => isDone(m) || pending.has(m.id)).length} of{' '}
                {c.materials.length} done
              </AppText>
            </View>
          </View>
          {c.materials.length === 0 ? <AppText muted>No materials yet.</AppText> : null}
          {c.materials.map((m) => (
            <View
              key={m.id}
              onLayout={(e) => (offsets.current.items[m.id] = e.nativeEvent.layout.y)}
            >
              <TalaMaterialRow
                upNext={next?.id === m.id}
                m={m}
                saved={downloaded[m.id]}
                waiting={pending.has(m.id)}
                busy={busy === m.id}
                lockedBy={lockedBy.get(m.id) ?? null}
                progress={progress?.id === m.id ? progress : null}
                onCancel={() => abort.current?.abort()}
                canMarkCompleted={
                  !lockedBy.has(m.id) &&
                  c.progress_submission &&
                  m.type === 'pdf' &&
                  m.viewable &&
                  Boolean(downloaded[m.id]?.openedAt) &&
                  !(isDone(m) || pending.has(m.id))
                }
                completeHint={
                  !lockedBy.has(m.id) &&
                  c.progress_submission &&
                  m.type === 'pdf' &&
                  m.viewable &&
                  !downloaded[m.id]?.openedAt &&
                  !(isDone(m) || pending.has(m.id))
                    ? 'Download and open it to mark it completed.'
                    : null
                }
                onOpen={() => openMaterial(m)}
                onDownload={() => void download(m)}
                onRemove={() => void remove(m)}
                onMarkCompleted={() => void completeWith(m)}
              />
            </View>
          ))}
          {c.hidden_materials > 0 ? (
            <AppText variant="caption" muted>
              {c.hidden_materials} item(s) in this course are not supported in this version of the
              app.
            </AppText>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  content: { padding: spacing.lg, gap: spacing.lg },
  materialsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
});
