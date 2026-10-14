import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button } from '@/components';
import { colors, spacing } from '@/constants/theme';
import { HELP } from './content';
import { useHelp } from './parts';
import {
  CYCLES,
  PHASE_LABEL,
  clock,
  initial,
  pause,
  reset,
  secondsLeft,
  start,
  tick,
  tip,
} from './pomodoro';

const KEEP_AWAKE = 'astra-pomodoro';

export function PomodoroScreen() {
  const help = useHelp(HELP.pomodoro);
  const [timer, setTimer] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  // One steady beat. The timer itself counts wall-clock time, so a late or skipped beat never loses a second.
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setTimer((t) => tick(t, at));
    }, 250);
    return () => clearInterval(id);
  }, [timer.running]);

  // The screen stays awake only while the timer runs, and is released when it stops or the screen closes.
  useEffect(() => {
    if (timer.running) void activateKeepAwakeAsync(KEEP_AWAKE).catch(() => undefined);
    else void deactivateKeepAwake(KEEP_AWAKE).catch(() => undefined);
    return () => void deactivateKeepAwake(KEEP_AWAKE).catch(() => undefined);
  }, [timer.running]);

  const view = tick(timer, now); // shows the right phase even between two beats
  const left = secondsLeft(view, now);
  const message = tip(view.phase, view.completed);
  const started = view.running || view.completed > 0 || view.phase !== 'work' || left < 1500;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {help}
      <View style={styles.clockBlock}>
        {message ? <AppText style={styles.message}>{message}</AppText> : null}
        <AppText
          style={styles.clock}
          accessibilityLabel={`${Math.floor(left / 60)} minutes ${left % 60} seconds left`}
        >
          {clock(left)}
        </AppText>
        <AppText variant="heading" accessibilityRole="header" style={styles.phase}>
          {PHASE_LABEL[view.phase]}
        </AppText>
      </View>
      <View style={styles.buttons}>
        <View style={styles.buttonCell}>
          <Button
            title={view.running ? 'Pause' : started ? 'Resume' : 'Start'}
            onPress={() => {
              const at = Date.now();
              setNow(at);
              setTimer((t) => (t.running ? pause(t, at) : start(t, at)));
            }}
          />
        </View>
        {started ? (
          <View style={styles.buttonCell}>
            <Button
              title="Reset"
              variant="secondary"
              onPress={() => {
                setNow(Date.now());
                setTimer(reset());
              }}
            />
          </View>
        ) : null}
      </View>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${view.completed} of ${CYCLES} work sessions finished`}
      >
        {Array.from({ length: CYCLES }, (_, i) => (
          <View key={i} style={[styles.dot, i < view.completed && styles.dotDone]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingTop: spacing.xxxl },
  clockBlock: { alignItems: 'center', gap: spacing.sm },
  clock: { fontSize: 80, lineHeight: 92, fontVariant: ['tabular-nums'], color: colors.text },
  phase: { color: colors.textMuted },
  message: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.md },
  buttonCell: { flex: 1 },
  dots: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
});
