import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, CourseImage, GlyphIcon, type GlyphName } from '@/components';
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

/**
 * One material, laid out as in the original Tala app: a small picture on the left, the name with "Type" and "Status"
 * lines, and the download / delete icon on the right. Tapping the row opens it.
 */
export function TalaMaterialRow({
  m,
  saved,
  waiting,
  busy,
  canMarkCompleted,
  onOpen,
  onDownload,
  onRemove,
  onMarkCompleted,
}: {
  m: TalaMaterialSummary;
  saved: DownloadRecord | undefined;
  waiting: boolean;
  busy: boolean;
  canMarkCompleted: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onMarkCompleted: () => void;
}) {
  const stats = materialStatsLine(m);
  const hasFile = m.viewable && (m.type === 'video' || m.type === 'pdf');
  const status = waiting
    ? 'Completed, waiting to send'
    : (statusWord(m.status) ?? (isDone(m) ? 'Completed' : 'Not started'));
  const typeLabel = TYPE_LABEL[m.type] ?? m.type;
  const action =
    m.type === 'quiz'
      ? isDone(m)
        ? 'Retake quiz'
        : 'Take quiz'
      : m.type === 'flashcards'
        ? isDone(m)
          ? 'Practice flashcards'
          : 'Study flashcards'
        : saved
          ? m.type === 'video'
            ? 'Watch offline copy'
            : 'Open offline copy'
          : m.type === 'video'
            ? 'Watch'
            : 'Open';

  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            m.viewable ? `${action}: ${m.name}` : `${m.name}, not available in this version`
          }
          accessibilityState={{ disabled: !m.viewable }}
          disabled={!m.viewable}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.tap,
            pressed && styles.pressed,
            !m.viewable && styles.dim,
          ]}
        >
          <CourseImage
            uri={m.thumbnail_url}
            title={m.name}
            style={styles.thumb}
            fallback={<GlyphIcon name={ICON[m.type] ?? 'pdf'} size={26} />}
          />
          <View style={styles.text}>
            <AppText style={styles.name}>{m.name}</AppText>
            <AppText variant="caption" muted>
              Type : {typeLabel}
            </AppText>
            <AppText variant="caption" muted>
              Status : {status}
            </AppText>
            {stats ? (
              <AppText variant="caption" style={{ color: colors.primary }}>
                {stats}
              </AppText>
            ) : null}
            {saved ? (
              <AppText variant="caption" muted>
                Saved on this device ({Math.max(1, Math.round(saved.bytes / 1024))} KB)
              </AppText>
            ) : null}
            {!m.viewable ? (
              <AppText variant="caption" muted>
                {m.type === 'flashcards' ? 'Flashcards' : 'Quizzes'} are not available in this
                version.
              </AppText>
            ) : null}
          </View>
        </Pressable>

        {canMarkCompleted ? (
          <Button
            title="Mark as completed"
            variant="secondary"
            onPress={onMarkCompleted}
            style={styles.mark}
          />
        ) : null}
      </View>

      {hasFile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove download' : 'Download for offline'}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={saved ? onRemove : onDownload}
          style={({ pressed }) => [styles.icon, pressed && styles.pressed, busy && styles.dim]}
        >
          <GlyphIcon name={saved ? 'trash' : 'download'} />
        </Pressable>
      ) : m.viewable ? (
        <View
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AppText muted>›</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  main: { flex: 1, gap: spacing.sm },
  tap: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget + spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: 'Quicksand_700Bold', fontSize: 16, lineHeight: 22, color: colors.text },
  icon: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.6 },
  dim: { opacity: 0.55 },
});
