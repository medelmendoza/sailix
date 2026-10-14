import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
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
import { Grid, GridTile, Pair, Picture, Tile, useHelp } from './parts';

type Nav<N extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, N>;

const page = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } }).content;

/** The 2x2 chart: probability up the page, impact across. Tap a cell to read what to do. */
export function RiskScreen() {
  const help = useHelp(HELP.risk);
  const [picked, setPicked] = useState<number | null>(null);
  const q = picked === null ? null : QUADRANTS[picked]!;
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <AppText muted>Tap one of the boxes to learn more.</AppText>
      <View style={styles.chart} accessibilityRole="radiogroup">
        <AppText variant="caption" muted style={styles.axisY}>
          Probability ↑
        </AppText>
        <View style={styles.grid}>
          {QUADRANTS.map((cell, i) => {
            const on = picked === i;
            return (
              <Pressable
                key={cell.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${cell.probability} probability, ${cell.impact} impact: ${cell.title}`}
                onPress={() => setPicked(i)}
                style={[styles.cell, on && styles.cellOn]}
              >
                <AppText variant="heading" style={{ color: on ? colors.onPrimary : colors.text }}>
                  {cell.title.replace(' your risk!', '')}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: on ? colors.onPrimary : colors.textMuted }}
                >
                  {cell.probability} probability · {cell.impact} impact
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" muted style={styles.axisX}>
          Impact →
        </AppText>
      </View>
      {q ? (
        <View accessibilityLiveRegion="polite">
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading">{q.title}</AppText>
            <AppText>{q.text}</AppText>
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

export function RcaScreen({ navigation }: Nav<'AstraRca'>) {
  const help = useHelp(HELP.rca);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <Grid>
        <GridTile
          title="5 Whys"
          glyph="quiz"
          tone="coral"
          onPress={() => navigation.navigate('AstraWhys')}
        />
        <GridTile
          title="P.M.E.P.E"
          glyph="search"
          onPress={() => navigation.navigate('AstraPmepe')}
        />
      </Grid>
    </ScrollView>
  );
}

export function WhysScreen() {
  return (
    <ScrollView contentContainerStyle={page}>
      <AppText variant="title" accessibilityRole="header">
        Root cause analysis: 5 Whys
      </AppText>
      <AppText>{WHYS_BLURB}</AppText>
      <Pair word="Define the problem" covers="State clearly what went wrong." />
      <Picture
        source={require('../../../assets/astra/images/whys.png')}
        label="Diagram of asking why five times"
      />
      <Pair
        word="Broader or deeper?"
        covers="Decide whether to look wider or ask why again."
        tone="accent"
      />
    </ScrollView>
  );
}

export function PmepeScreen({ navigation }: Nav<'AstraPmepe'>) {
  const help = useHelp(HELP.pmepe);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <Picture
        source={require('../../../assets/astra/images/monkey.png')}
        label="Purple monkey eating a pink elephant"
      />
      <AppText variant="heading" accessibilityLabel="Purple Monkey Eating Pink Elephant">
        <AppText variant="heading" style={{ color: colors.coralText }}>
          P
        </AppText>
        urple{' '}
        <AppText variant="heading" style={{ color: colors.coralText }}>
          M
        </AppText>
        onkey{' '}
        <AppText variant="heading" style={{ color: colors.coralText }}>
          E
        </AppText>
        ating{' '}
        <AppText variant="heading" style={{ color: colors.coralText }}>
          P
        </AppText>
        ink{' '}
        <AppText variant="heading" style={{ color: colors.coralText }}>
          E
        </AppText>
        lephant
      </AppText>
      {PMEPE.map((r) => (
        <View key={r.category} style={{ gap: spacing.xs }}>
          <Pair word={r.category} covers={r.word} />
          <AppText muted style={{ marginLeft: spacing.sm }}>
            {r.covers}
          </AppText>
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
      <AppText variant="title" accessibilityRole="header">
        S.C.A.R.I.L
      </AppText>
      {SCARIL.map((r) => (
        <Pair key={r.word} word={r.word} covers={r.covers} />
      ))}
      <Button
        title="Detailed view"
        onPress={() => navigation.navigate('AstraDoc', { doc: 'scaril' })}
      />
    </ScrollView>
  );
}

export function EmailsScreen({ navigation }: Nav<'AstraEmails'>) {
  const help = useHelp(HELP.emails);
  return (
    <ScrollView contentContainerStyle={page}>
      {help}
      <AppText variant="title" accessibilityRole="header">
        How to write an effective email
      </AppText>
      {EMAIL_STEPS.map((s) => (
        <Tile
          key={s.step}
          title={s.label}
          onPress={() => navigation.navigate('AstraEmailStep', { step: s.step })}
        />
      ))}
    </ScrollView>
  );
}

export function EmailStepScreen({ route, navigation }: Nav<'AstraEmailStep'>) {
  const { step } = route.params;
  if (step === 'to-cc') {
    return (
      <ScrollView contentContainerStyle={page}>
        <AppText variant="title" accessibilityRole="header">
          {TO_CC.heading}
        </AppText>
        <AppText muted>{TO_CC.sub}</AppText>
        {TO_CC.items.map((i) => (
          <View key={i.word} style={{ gap: spacing.xs }}>
            <Pair word={i.word} covers="" tone={i.word === 'To' ? 'primary' : 'accent'} />
            <AppText>{i.covers}</AppText>
          </View>
        ))}
      </ScrollView>
    );
  }
  if (step === 'raid') {
    return (
      <ScrollView contentContainerStyle={page}>
        <AppText variant="title" accessibilityRole="header">
          {RAID.heading}
        </AppText>
        <AppText muted>{RAID.sub}</AppText>
        {RAID.items.map((i) => (
          <Pair key={i.word} word={i.word} covers={i.covers} />
        ))}
        <Card variant="inset" style={{ gap: spacing.sm }}>
          <AppText variant="heading">Example</AppText>
          <AppText muted>Before:</AppText>
          <AppText>{RAID.before}</AppText>
          <AppText muted>After:</AppText>
          <AppText>{RAID.after}</AppText>
        </Card>
      </ScrollView>
    );
  }
  if (step === 'bluf') {
    return (
      <ScrollView contentContainerStyle={page}>
        <AppText variant="title" accessibilityRole="header">
          {BLUF.heading}
        </AppText>
        <AppText muted>{BLUF.sub}</AppText>
        {BLUF.items.map((i) => (
          <Pair key={i.word} word={i.word} covers={i.covers} />
        ))}
        <Button
          title="See an example"
          onPress={() => navigation.navigate('AstraDoc', { doc: 'bluf' })}
        />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={page}>
      <AppText variant="title" accessibilityRole="header">
        Next steps
      </AppText>
      <AppText>{NEXT_STEPS}</AppText>
      <Tile title="Root cause analysis" onPress={() => navigation.navigate('AstraRca')} />
      <Tile title="SCARIL" onPress={() => navigation.navigate('AstraScaril')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chart: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '48.5%',
    minHeight: 110,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cellOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  axisY: { alignSelf: 'flex-start' },
  axisX: { alignSelf: 'flex-end' },
});
