import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  CourseImage,
  GlyphIcon,
  type GlyphName,
  ProgressBar,
} from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import type { TalaMaterialSummary } from '@/services/api/types';
import type { DownloadRecord } from './offline/store';
import { isDone, materialStatsLine, statusWord, TYPE_LABEL } from './materials';

const ICON: Record<string, GlyphName> = {
  video: 'video',
  pdf: 'pdf',
  quiz: 'quiz',
  flashcards: 'cards',
};

/** A soft colour for each kind of material: the badge behind its icon. */
const megabytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const TINT: Record<string, { bg: string; ink: string }> = {
  video: { bg: colors.infoBg, ink: colors.primary },
  pdf: { bg: colors.warningBg, ink: colors.warning },
  quiz: { bg: colors.successBg, ink: colors.success },
  flashcards: { bg: colors.dangerBg, ink: colors.danger },
};

type Tone = 'done' | 'waiting' | 'progress' | 'idle';
const CHIP: Record<Tone, { bg: string; ink: string }> = {
  done: { bg: colors.successBg, ink: colors.success },
  waiting: { bg: colors.warningBg, ink: colors.warning },
  progress: { bg: colors.infoBg, ink: colors.primary },
  idle: { bg: colors.surfaceSunken, ink: colors.textMuted },
};

/**
 * One material as a card: a coloured badge for its kind (or its picture), the name, a status chip, what the learner
 * achieved, and one clear action. A video or a PDF has to be downloaded before it can be opened, as in the Tala app.
 */
export function TalaMaterialRow({
  m,
  saved,
  waiting,
  busy,
  lockedBy,
  upNext,
  progress,
  onCancel,
  canMarkCompleted,
  completeHint,
  onOpen,
  onDownload,
  onRemove,
  onMarkCompleted,
}: {
  m: TalaMaterialSummary;
  saved: DownloadRecord | undefined;
  waiting: boolean;
  busy: boolean;
  /** Name of the earlier material that must be completed first (an ordered course), or null. */
  lockedBy?: string | null;
  /** The material to do next: marked so the learner sees where to go on. */
  upNext?: boolean;
  /** How far a download has got; `total` is -1 when the size is not known. */
  progress?: { written: number; total: number } | null;
  onCancel?: () => void;
  canMarkCompleted: boolean;
  /** Why a document cannot be marked completed yet. */
  completeHint?: string | null;
  onOpen: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onMarkCompleted: () => void;
}) {
  const stats = lockedBy ? null : materialStatsLine(m);
  const isFile = m.type === 'video' || m.type === 'pdf';
  const known = statusWord(m.status);
  const tone: Tone = lockedBy
    ? 'idle'
    : waiting
      ? 'waiting'
      : isDone(m)
        ? 'done'
        : known
          ? 'progress'
          : 'idle';
  const status = lockedBy
    ? 'Locked'
    : waiting
      ? 'Completed, waiting to send'
      : (known ?? (isDone(m) ? 'Completed' : 'Not started'));
  const typeLabel = TYPE_LABEL[m.type] ?? m.type;
  const tint = TINT[m.type] ?? TINT.pdf!;

  // the one action, and what it does
  const action: { text: string; run: () => void; primary: boolean } | null =
    lockedBy || !m.viewable
      ? null
      : m.type === 'quiz'
        ? { text: isDone(m) ? 'Retake quiz' : 'Take quiz', run: onOpen, primary: true }
        : m.type === 'flashcards'
          ? {
              text: isDone(m) ? 'Practice flashcards' : 'Study flashcards',
              run: onOpen,
              primary: true,
            }
          : saved
            ? { text: m.type === 'video' ? 'Watch' : 'Open', run: onOpen, primary: true }
            : {
                text: m.type === 'video' ? 'Download to watch' : 'Download to open',
                run: onDownload,
                primary: false,
              };

  return (
    <Card
      variant="flat"
      style={{
        ...styles.card,
        ...(lockedBy ? styles.lockedCard : null),
        ...(upNext ? styles.upNextCard : null),
      }}
    >
      <View
        style={styles.head}
        accessible
        accessibilityLabel={`${m.name}. ${typeLabel}. ${status}.`}
      >
        <View>
          <CourseImage
            uri={m.thumbnail_url}
            title={m.name}
            style={{ ...styles.thumb, backgroundColor: tint.bg }}
            fallback={<GlyphIcon name={ICON[m.type] ?? 'pdf'} size={26} color={tint.ink} />}
          />
          {lockedBy ? (
            <View style={styles.lockVeil}>
              <View style={styles.lockBadge}>
                <GlyphIcon name="lock" size={18} color={colors.onPrimary} />
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.text}>
          <View style={styles.typeRow}>
            <AppText variant="caption" style={{ color: tint.ink }}>
              {typeLabel}
            </AppText>
            {upNext ? (
              <View style={styles.upNextPill}>
                <AppText variant="caption" style={{ color: colors.onPrimary }}>
                  Up next
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText style={styles.name}>{m.name}</AppText>
          <View
            style={[styles.chip, { backgroundColor: lockedBy ? colors.surface : CHIP[tone].bg }]}
          >
            {lockedBy ? <GlyphIcon name="lock" size={13} color={CHIP[tone].ink} /> : null}
            <AppText variant="caption" style={{ color: CHIP[tone].ink }}>
              {status}
            </AppText>
          </View>
        </View>
      </View>

      {stats ? (
        <AppText variant="caption" style={{ color: colors.primary }}>
          {stats}
        </AppText>
      ) : null}
      {saved ? (
        <AppText variant="caption" muted>
          Saved on this device ({megabytes(saved.bytes)})
        </AppText>
      ) : null}
      {lockedBy ? (
        <View
          accessible
          accessibilityLabel={`Locked. Complete ${lockedBy} first to unlock this.`}
          style={styles.lockNote}
        >
          <View style={styles.lockNoteIcon}>
            <GlyphIcon name="lock" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              Unlocks when you complete
            </AppText>
            <AppText style={styles.lockNoteName} numberOfLines={2}>
              {lockedBy}
            </AppText>
          </View>
        </View>
      ) : null}
      {!m.viewable ? (
        <AppText variant="caption" muted>
          {m.type === 'flashcards' ? 'Flashcards' : 'Quizzes'} are not available in this version.
        </AppText>
      ) : null}

      {progress ? (
        <View style={styles.progress}>
          <ProgressBar
            percent={progress.total > 0 ? (progress.written / progress.total) * 100 : 0}
            label={`Downloading ${m.name}`}
          />
          <View style={styles.progressRow}>
            <AppText variant="caption" muted style={{ flex: 1 }}>
              {progress.total > 0
                ? `Downloading… ${Math.floor((progress.written / progress.total) * 100)}% (${megabytes(progress.written)} of ${megabytes(progress.total)})`
                : `Downloading… ${megabytes(progress.written)}`}
            </AppText>
            <Button
              title="Cancel"
              accessibilityLabel={`Cancel download: ${m.name}`}
              variant="secondary"
              onPress={onCancel ?? (() => {})}
              style={styles.cancel}
            />
          </View>
        </View>
      ) : action || canMarkCompleted ? (
        <View style={styles.actions}>
          {action ? (
            <Button
              title={busy && isFile && !saved ? 'Downloading…' : action.text}
              accessibilityLabel={`${action.text}: ${m.name}`}
              variant={action.primary ? 'primary' : 'secondary'}
              loading={false}
              disabled={busy}
              onPress={action.run}
              style={styles.action}
            />
          ) : null}
          {isFile && saved ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove download"
              accessibilityState={{ busy }}
              disabled={busy}
              onPress={onRemove}
              style={({ pressed }) => [
                styles.remove,
                pressed && styles.pressed,
                busy && styles.dim,
              ]}
            >
              <GlyphIcon name="trash" color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {completeHint ? (
        <AppText variant="caption" muted>
          {completeHint}
        </AppText>
      ) : null}
      {canMarkCompleted ? (
        <Button
          title="Mark as completed"
          variant="secondary"
          onPress={onMarkCompleted}
          style={styles.mark}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: radius.md },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: 'Quicksand_700Bold', fontSize: 16, lineHeight: 22, color: colors.text },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginTop: 2,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upNextPill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  upNextCard: { borderWidth: 2, borderColor: colors.primary },
  lockedCard: { backgroundColor: colors.surfaceSunken },
  lockVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: 'rgba(18, 36, 61, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 36, 61, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  lockNoteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockNoteName: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  progress: { gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancel: { minHeight: 36, paddingHorizontal: spacing.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { flex: 1 },
  remove: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.6 },
  dim: { opacity: 0.55 },
});
