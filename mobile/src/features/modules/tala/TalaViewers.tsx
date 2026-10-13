import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AppStackParamList } from '@/app/navigation/types';
import { Notice } from '@/components';
import { spacing } from '@/constants/theme';
import { scopedKey } from '@/store/scopedKey';
import { queueCompletion, syncOutbox } from './offline/outbox';

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

  // Watching to the end counts as completing the item; it is queued and delivered like any other completion.
  useEventListener(player, 'playToEnd', () => {
    if (!canComplete) return;
    void queueCompletion(assignId, materialId)
      .then(() => queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'outbox') }))
      .then(() => syncOutbox())
      .catch(() => undefined);
  });

  return (
    <View style={styles.fill}>
      <VideoView player={player} style={styles.video} nativeControls />
      {canComplete ? (
        <View style={{ padding: spacing.lg }}>
          <Notice message="This item is marked completed when the video finishes." />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
});
