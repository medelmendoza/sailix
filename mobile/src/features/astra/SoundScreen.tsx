import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, ErrorState } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { finished, idle, msLeft, pauseSession, play, stopSession } from './listening';
import { DURATIONS_MIN, findSound, playTime } from './sounds';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraSound'>;

/** Kept outside the component: the player is a native object, not React state. */
function enableLoop(player: { loop: boolean }) {
  player.loop = true;
}

/** Plays one background sound for the chosen time. It stops when you leave the screen (no background audio). */
export function SoundScreen({ route }: Props) {
  const sound = findSound(route.params.id);
  if (!sound) return <ErrorState message="That sound is not available." />;
  return <Player sound={sound} />;
}

function Player({ sound }: { sound: NonNullable<ReturnType<typeof findSound>> }) {
  useKeepAwake('astra-sound'); // the screen stays awake while this screen is open, as in the original
  const player = useAudioPlayer(sound.audio);
  const [minutes, setMinutes] = useState<number>(5);
  const [session, setSession] = useState(() => idle(5));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    enableLoop(player); // the clip repeats until the chosen time is up
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(
      () => undefined,
    );
    return () => {
      try {
        player.pause();
      } catch {
        // the player may already be released
      }
    };
  }, [player]);

  useEffect(() => {
    if (session.status !== 'playing') return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (finished(session, at)) {
        player.pause();
        void player.seekTo(0);
        setSession(stopSession(session));
      }
    }, 500);
    return () => clearInterval(id);
  }, [session, player]);

  function choose(m: number) {
    setMinutes(m);
    setSession(idle(m));
  }
  function toggle() {
    const at = Date.now();
    setNow(at);
    if (session.status === 'playing') {
      player.pause();
      setSession(pauseSession(session, at));
    } else {
      player.play();
      setSession(play(session, at));
    }
  }
  function stop() {
    player.pause();
    void player.seekTo(0);
    setSession(stopSession(session));
  }

  const left = Math.ceil(msLeft(session, now) / 1000);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image
        source={sound.image}
        accessibilityLabel={`${sound.title} picture`}
        style={styles.hero}
      />
      <AppText variant="title" accessibilityRole="header">
        {sound.title}
      </AppText>
      <AppText variant="heading" accessibilityLabel={`${playTime(left)} left`}>
        {playTime(left)} left
      </AppText>
      <View style={styles.row}>
        <Button
          title={
            session.status === 'playing' ? 'Pause' : session.status === 'paused' ? 'Resume' : 'Play'
          }
          onPress={toggle}
          style={{ flex: 1 }}
        />
        {session.status !== 'stopped' ? (
          <Button title="Stop" variant="secondary" onPress={stop} style={{ flex: 1 }} />
        ) : null}
      </View>
      <AppText variant="caption" muted>
        The sound plays for {minutes} minutes. Choose how long below; you can change it while
        stopped.
      </AppText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DURATIONS_MIN.map((m) => {
          const picked = m === minutes;
          const locked = session.status !== 'stopped';
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityLabel={`${m} minutes`}
              accessibilityState={{ checked: picked, disabled: locked && !picked }}
              disabled={locked}
              onPress={() => choose(m)}
              style={[
                styles.chip,
                picked && styles.chipPicked,
                locked && !picked && { opacity: 0.45 },
              ]}
            >
              <AppText variant="caption" style={{ color: picked ? colors.onPrimary : colors.text }}>
                {m} min
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { width: '100%', height: 220, borderRadius: radius.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouchTarget,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPicked: { backgroundColor: colors.primary, borderColor: colors.primary },
});
