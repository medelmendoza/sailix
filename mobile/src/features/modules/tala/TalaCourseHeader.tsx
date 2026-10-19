import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, CourseImage, GlyphIcon } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import type { TalaCourseDetail } from '@/services/api/types';
import { TalaCourseProgress } from './TalaCourseProgress';
import { dueInfo, type Due } from './stats';

const DUE_CHIP: Record<Due['tone'], { bg: string; ink: string }> = {
  done: { bg: colors.successBg, ink: colors.success },
  overdue: { bg: colors.dangerBg, ink: colors.danger },
  soon: { bg: colors.warningBg, ink: colors.warning },
  ok: { bg: colors.surfaceSunken, ink: colors.textMuted },
  upcoming: { bg: colors.infoBg, ink: colors.primary },
};

const LONG_DESCRIPTION = 180;

/**
 * The top of a course page: the picture with the summary card overlapping it (state, title, creator, progress and
 * three counters), then the course description, which folds when it is long.
 */
export function TalaCourseHeader({ c, saved }: { c: TalaCourseDetail; saved: number }) {
  const due = dueInfo(c);
  const [open, setOpen] = useState(false);
  const long = (c.description?.length ?? 0) > LONG_DESCRIPTION;
  const chip = due ? DUE_CHIP[due.tone] : null;
  return (
    <>
      <View>
        <CourseImage uri={c.thumbnail_url} title={c.name} style={styles.hero} />
        <View style={styles.summaryWrap}>
          <Card variant="flat" style={styles.summary}>
            {due && chip ? (
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <GlyphIcon name="clock" size={14} color={chip.ink} />
                <AppText variant="caption" style={{ color: chip.ink }}>
                  {due.text}
                  {due.tone !== 'done' && c.date_to ? ` · due ${c.date_to}` : ''}
                </AppText>
              </View>
            ) : null}
            <AppText variant="title" accessibilityRole="header" style={styles.courseName}>
              {c.name}
            </AppText>
            <View style={styles.creator}>
              <View style={styles.creatorIcon}>
                <GlyphIcon name="person" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" muted>
                  Creator
                </AppText>
                <AppText style={styles.creatorName}>{c.creator ?? 'Unknown'}</AppText>
              </View>
            </View>
            <TalaCourseProgress course={c} showDue={false} />
            <View style={styles.tiles}>
              <Counter
                value={c.completed}
                label="Done"
                tone={colors.success}
                bg={colors.successBg}
              />
              <Counter
                value={Math.max(0, c.total - c.completed)}
                label="To do"
                tone={colors.primary}
                bg={colors.infoBg}
              />
              <Counter
                value={saved}
                label="Saved offline"
                tone={colors.warning}
                bg={colors.warningBg}
              />
            </View>
          </Card>
        </View>
      </View>

      <Card variant="flat" style={styles.about}>
        <AppText variant="heading" accessibilityRole="header">
          About this course
        </AppText>
        <AppText muted={!c.description} numberOfLines={long && !open ? 4 : undefined}>
          {c.description ?? 'No description.'}
        </AppText>
        {long ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Show less' : 'Read more'}
            onPress={() => setOpen((v) => !v)}
            style={styles.more}
          >
            <AppText style={styles.moreText}>{open ? 'Show less' : 'Read more'}</AppText>
          </Pressable>
        ) : null}
      </Card>
    </>
  );
}

function Counter({
  value,
  label,
  tone,
  bg,
}: {
  value: number;
  label: string;
  tone: string;
  bg: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.tile, { backgroundColor: bg }]}
    >
      <AppText style={[styles.tileValue, { color: tone }]}>{value}</AppText>
      <AppText variant="caption" style={{ color: tone }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 230,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  // the summary sits half over the picture; the padding below makes room for the part that hangs out
  summaryWrap: { marginTop: -56, paddingHorizontal: spacing.lg },
  summary: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  courseName: { fontSize: 22, lineHeight: 28 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  creatorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorName: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  tileValue: { fontFamily: 'Quicksand_700Bold', fontSize: 22, lineHeight: 28 },
  about: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  more: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  moreText: { fontFamily: 'Quicksand_700Bold', color: colors.primary },
});
