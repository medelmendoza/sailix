import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, GlyphIcon } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import {
  BLUF,
  EMAIL_STEPS,
  HELP,
  NEXT_STEPS,
  PMEPE,
  QUADRANTS,
  RAID,
  SCARIL,
  TO_CC,
  WHYS_BLURB,
} from './content';
import {
  CenterTitle,
  DownArrow,
  Grid,
  GridTile,
  NoteBox,
  Picture,
  Tag,
  TagNote,
  useHelp,
} from './parts';

type Nav<N extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, N>;

const page = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } }).content;

/** The 2x2 chart, as in the original: probability up the side, impact along the bottom. Tapping a box opens its advice. */
export function RiskScreen() {
  const help = useHelp(HELP.risk);
  const [picked, setPicked] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const q = picked === null ? null : QUADRANTS[picked]!;
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <CenterTitle sub="Click one of the quadrants to learn more." />
      <View style={styles.chart}>
        <View style={styles.chartRow}>
          <View style={styles.axisY} accessibilityElementsHidden importantForAccessibility="no">
            <AppText style={styles.axisYLabel}>Probability</AppText>
            <AppText style={styles.axisArrow}>↑</AppText>
          </View>
          <View style={styles.grid}>
            {QUADRANTS.map((cell, i) => {
              const on = picked === i;
              return (
                <Pressable
                  key={cell.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${cell.probability} probability, ${cell.impact} impact: ${cell.title}`}
                  onPress={() => {
                    setPicked(i);
                    setOpen(true);
                  }}
                  style={[styles.cell, on && styles.cellOn]}
                >
                  <AppText variant="heading">{cell.title.replace(' your risk!', '')}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <AppText style={styles.axisX} accessibilityElementsHidden>
          → Impact
        </AppText>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.scrim}
          onPress={() => setOpen(false)}
        />
        {q ? (
          <View style={styles.sheet}>
            <AppText variant="heading" accessibilityRole="header">
              {q.title}
            </AppText>
            <AppText>{q.text}</AppText>
            <Button title="Got it" variant="secondary" onPress={() => setOpen(false)} />
          </View>
        ) : null}
      </Modal>
    </ScrollView>
  );
}

export function RcaScreen({ navigation }: Nav<'AstraRca'>) {
  const help = useHelp(HELP.rca);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <Grid>
        <GridTile title="5 Whys" glyph="quiz" onPress={() => navigation.navigate('AstraWhys')} />
        <GridTile
          title="P.M.E.P.E"
          glyph="search"
          onPress={() => navigation.navigate('AstraPmepe')}
        />
      </Grid>
    </ScrollView>
  );
}

/** Define the problem, ask why again and again, then decide: broader or deeper. */
export function WhysScreen() {
  return (
    <ScrollView contentContainerStyle={page}>
      <CenterTitle title="5 Whys" sub={WHYS_BLURB} />
      <View style={styles.flow}>
        <Tag word="Define the problem" />
        <DownArrow />
        <Picture
          source={require('../../../assets/astra/images/whys.png')}
          label="Diagram of asking why five times"
        />
        <DownArrow />
        <Tag word="Broader or deeper?" tone="accent" />
      </View>
    </ScrollView>
  );
}

/** P.M.E.P.E, first page: the picture, the mnemonic with its initials picked out, and a way on to the details. */
export function PmepeScreen({ navigation }: Nav<'AstraPmepe'>) {
  const help = useHelp(HELP.pmepe);
  const initial = (t: string) => (
    <AppText variant="title" style={{ color: colors.coralText }}>
      {t}
    </AppText>
  );
  const rest = (t: string) => <AppText variant="title">{t}</AppText>;
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <CenterTitle title="P.M.E.P.E" />
      <Picture
        source={require('../../../assets/astra/images/monkey.png')}
        label="Purple monkey eating a pink elephant"
      />
      <View
        style={styles.mnemonic}
        accessible
        accessibilityLabel="Purple Monkey Eating Pink Elephant"
      >
        <AppText style={{ textAlign: 'center' }}>
          {initial('P')}
          {rest('urple ')}
          {initial('M')}
          {rest('onkey ')}
          {initial('E')}
          {rest('ating ')}
          {initial('P')}
          {rest('ink ')}
          {initial('E')}
          {rest('lephant')}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Click to learn more"
        onPress={() => navigation.navigate('AstraPmepeDetail')}
        style={styles.more}
      >
        <View style={styles.moreCircle}>
          <GlyphIcon name="download" color={colors.onPrimary} size={26} />
        </View>
        <AppText variant="heading">Click to learn more.</AppText>
      </Pressable>
    </ScrollView>
  );
}

/** P.M.E.P.E, second page: each category next to its word, with what it covers, and the detailed guide. */
export function PmepeDetailScreen({ navigation }: Nav<'AstraPmepeDetail'>) {
  const help = useHelp(HELP.pmepe);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <CenterTitle title="P.M.E.P.E" />
      {PMEPE.map((r) => (
        <View
          key={r.category}
          style={styles.pmepeRow}
          accessible
          accessibilityLabel={`${r.category}: ${r.word}. ${r.covers}`}
        >
          <View style={styles.pmepeTags}>
            <Tag word={r.category} />
            <Tag word={r.word} tone="accent" />
          </View>
          <NoteBox>{r.covers}</NoteBox>
        </View>
      ))}
      <Button
        title="Detailed view"
        onPress={() => navigation.navigate('AstraDoc', { doc: 'pmepe' })}
      />
    </ScrollView>
  );
}

export function ScarilScreen({ navigation }: Nav<'AstraScaril'>) {
  const help = useHelp(HELP.scaril);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      {SCARIL.map((r) => (
        <TagNote key={r.word} word={r.word} covers={r.covers} />
      ))}
      <Button
        title="Detailed view"
        onPress={() => navigation.navigate('AstraDoc', { doc: 'scaril' })}
      />
    </ScrollView>
  );
}

/** The four email steps as a chain of buttons with arrows between them. */
export function EmailsScreen({ navigation }: Nav<'AstraEmails'>) {
  const help = useHelp(HELP.emails);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <CenterTitle title="How to write an effective email" />
      <View style={styles.flow}>
        {EMAIL_STEPS.map((s, i) => (
          <View key={s.step} style={styles.flowItem}>
            {i > 0 ? <DownArrow /> : null}
            <Button
              title={s.label}
              onPress={() => navigation.navigate('AstraEmailStep', { step: s.step })}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function EmailStepScreen({ route, navigation }: Nav<'AstraEmailStep'>) {
  const { step } = route.params;
  if (step === 'to-cc') {
    return (
      <ScrollView contentContainerStyle={page}>
        <CenterTitle title={TO_CC.heading} sub={TO_CC.sub} />
        {TO_CC.items.map((i) => (
          <TagNote
            key={i.word}
            word={i.word}
            covers={i.covers}
            tone={i.word === 'CC' ? 'accent' : 'primary'}
          />
        ))}
      </ScrollView>
    );
  }
  if (step === 'raid') {
    return (
      <ScrollView contentContainerStyle={page}>
        <CenterTitle title={RAID.heading} sub={RAID.sub} />
        {RAID.items.map((i) => (
          <TagNote key={i.word} word={i.word} covers={i.covers} />
        ))}
        <Tag word="Example" tone="accent" />
        <NoteBox>{`Before:\n${RAID.before}`}</NoteBox>
        <NoteBox>{`After:\n${RAID.after}`}</NoteBox>
      </ScrollView>
    );
  }
  if (step === 'bluf') {
    return (
      <ScrollView contentContainerStyle={page}>
        <CenterTitle title={BLUF.heading} sub={BLUF.sub} />
        {BLUF.items.map((i) => (
          <TagNote key={i.word} word={i.word} covers={i.covers} />
        ))}
        <Button title="Example" onPress={() => navigation.navigate('AstraDoc', { doc: 'bluf' })} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={page}>
      <CenterTitle title="Next steps" sub={NEXT_STEPS} />
      <Grid>
        <GridTile
          title="Root cause analysis"
          glyph="search"
          onPress={() => navigation.navigate('AstraRca')}
        />
        <GridTile
          title="SCARIL"
          glyph="target"
          onPress={() => navigation.navigate('AstraScaril')}
        />
      </Grid>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chartRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  axisY: { width: 36, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg },
  axisYLabel: {
    width: 90,
    textAlign: 'center',
    transform: [{ rotate: '-90deg' }],
    marginBottom: 40,
  },
  axisArrow: { fontSize: 22, color: colors.coralText },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '50%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.sm,
  },
  cellOn: { backgroundColor: colors.infoBg },
  axisX: { alignSelf: 'center', color: colors.coralText },
  scrim: { flex: 1, backgroundColor: 'rgba(18, 36, 61, 0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  flow: { gap: spacing.sm, alignItems: 'stretch' },
  flowItem: { gap: spacing.sm },
  mnemonic: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  more: { alignItems: 'center', gap: spacing.sm, minHeight: minTouchTarget },
  moreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    transform: [{ rotate: '-90deg' }],
  },
  pmepeRow: { gap: spacing.sm },
  pmepeTags: { flexDirection: 'row', justifyContent: 'space-between' },
});
