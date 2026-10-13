import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AppStackParamList } from '@/app/navigation/types';
import { Notice } from '@/components';
import { spacing } from '@/constants/theme';
import { scopedKey } from '@/store/scopedKey';
import { queueCompletion, syncOutbox } from './offline/outbox';
import { TalaFeedbackModal } from './TalaFeedbackModal';

/** Plays and shows ONLY files that this app downloaded into its own directory (offline copies). */
export function TalaPdfScreen({ route }: NativeStackScreenProps<AppStackParamList, 'TalaPdf'>) {
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

export function TalaVideoScreen({ route }: NativeStackScreenProps<AppStackParamList, 'TalaVideo'>) {
  const { uri, assignId, materialId, canComplete } = route.params;
  const queryClient = useQueryClient();
  const player = useVideoPlayer(uri, (p) => p.play());

  const [askFeedback, setAskFeedback] = useState(false);

  // Watching to the end asks for feedback; the video counts as completed once it is given (as in the Tala app).
  useEventListener(player, 'playToEnd', () => {
    if (canComplete) setAskFeedback(true);
  });

  return (
    <View style={styles.fill}>
      <VideoView player={player} style={styles.video} nativeControls />
      {canComplete ? (
        <View style={{ padding: spacing.lg }}>
          <Notice message="When the video finishes you can rate it; it is then marked completed." />
        </View>
      ) : null}
      <TalaFeedbackModal
        visible={askFeedback}
        title={route.params.name}
        onCancel={() => setAskFeedback(false)}
        onSubmit={(feedback) => {
          setAskFeedback(false);
          void queueCompletion(assignId, materialId, feedback)
            .then(() => queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'outbox') }))
            .then(() => syncOutbox())
            .catch(() => undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
});
