import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { TalaRoutes } from '../routes';
import { AppText, Button, Card } from '../ui';
import { colors, radius, spacing } from '../ui/theme';
import { scopedKey } from '../runtime';
import { queueCompletion, syncOutbox } from '../offline/outbox';
import { TalaFeedbackModal } from './TalaFeedbackModal';
import { useBrand } from '../ui/brand';

/** Plays and shows ONLY files that this app downloaded into its own directory (offline copies). */
export function TalaPdfScreen({ route }: NativeStackScreenProps<TalaRoutes, 'TalaPdf'>) {
  const { uri } = route.params;
  return (
    <WebView
      source={{ uri }}
      originWhitelist={['file://*']}
      allowFileAccess
      allowingReadAccessToURL={uri.slice(0, uri.lastIndexOf('/') + 1)}
      javaScriptEnabled={false}
      style={styles.fill}
      accessibilityLabel="Document viewer"
    />
  );
}

/**
 * The video page. A video is completed in two steps, as in the Tala app: watch it to the end, then rate it. Nothing else
 * completes a video: there is no "mark as completed" for videos.
 */
export function TalaVideoScreen({ route }: NativeStackScreenProps<TalaRoutes, 'TalaVideo'>) {
  const { uri, assignId, materialId, canComplete, completed, name } = route.params;
  const queryClient = useQueryClient();
  const player = useVideoPlayer(uri, (p) => p.play());

  const [watched, setWatched] = useState(false);
  const [asking, setAsking] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const done = completed || rated !== null;

  // Reaching the end counts as watching it, and asks for the rating right away.
  useEventListener(player, 'playToEnd', () => {
    setWatched(true);
    if (canComplete && rated === null) setAsking(true);
  });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.player}>
        <VideoView player={player} style={styles.video} nativeControls />
      </View>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {name}
      </AppText>

      <Card variant="flat" style={styles.steps}>
        <AppText variant="heading" accessibilityRole="header">
          {done ? 'Completed' : 'Complete this video'}
        </AppText>
        {done ? (
          <AppText muted>
            {rated !== null
              ? `Thank you. Your rating: ${rated} of 5.`
              : 'You have already completed this video.'}
          </AppText>
        ) : canComplete ? (
          <>
            <Step number={1} done={watched} text="Watch the whole video" />
            <Step number={2} done={false} text="Rate it and leave a comment" />
            <Button title="Rate this video" disabled={!watched} onPress={() => setAsking(true)} />
            {!watched ? (
              <AppText variant="caption" muted>
                The rating unlocks when the video has finished.
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText muted>Sending progress is not available in this version.</AppText>
        )}
      </Card>

      <TalaFeedbackModal
        visible={asking}
        title={name}
        onCancel={() => setAsking(false)}
        onSubmit={(feedback) => {
          setAsking(false);
          setRated(feedback.rating);
          void queueCompletion(assignId, materialId, feedback)
            .then(() => queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'outbox') }))
            .then(() => syncOutbox())
            .then(() => queryClient.invalidateQueries({ queryKey: scopedKey('tala') }))
            .catch(() => undefined);
        }}
      />
    </ScrollView>
  );
}

function Step({ number, done, text }: { number: number; done: boolean; text: string }) {
  const brand = useBrand();
  return (
    <View
      style={styles.step}
      accessible
      accessibilityLabel={`Step ${number}: ${text}${done ? ', done' : ''}`}
    >
      <View style={[styles.stepDot, { backgroundColor: brand.infoBg }, done && styles.stepDotDone]}>
        <AppText variant="caption" style={{ color: done ? colors.onPrimary : brand.primary }}>
          {done ? '✓' : number}
        </AppText>
      </View>
      <AppText style={{ flex: 1 }}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: spacing.lg, gap: spacing.lg },
  player: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { fontSize: 22, lineHeight: 28 },
  steps: { gap: spacing.md, padding: spacing.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  stepDotDone: { backgroundColor: colors.success },
});
