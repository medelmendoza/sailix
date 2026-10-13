import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AppStackParamList } from '@/app/navigation/types';
import { ErrorState } from '@/components';
import { colors } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { downloadToCache, removeFromCache } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'DocumentViewer'>;

/**
 * Shows one of the member's own documents. The file is fetched with the bearer token into a temporary cache file,
 * shown, and deleted when the screen closes: a document is personal data and is never kept on the device.
 */
export function DocumentViewerScreen({ route }: Props) {
  const { id, source } = route.params;
  const [attempt, setAttempt] = useState(0);
  const key = `${id}:${attempt}`;
  // The result of the download that belongs to THIS id and attempt; anything older is ignored (no resets inside the effect).
  const [result, setResult] = useState<{
    key: string;
    file?: { uri: string; image: boolean };
    error?: unknown;
  } | null>(null);
  const current = result?.key === key ? result : null;

  useEffect(() => {
    let alive = true;
    downloadToCache(id, source)
      .then((f) => {
        if (alive) setResult({ key, file: { uri: f.uri, image: /\.(jpe?g|png)$/i.test(f.uri) } });
      })
      .catch((e) => alive && setResult({ key, error: e }));
    return () => {
      alive = false;
      removeFromCache(id);
    };
  }, [id, key, source]);

  if (current?.error) {
    return (
      <ErrorState message={describeError(current.error)} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }
  const file = current?.file;
  if (!file) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading the document" />
      </View>
    );
  }
  if (file.image) {
    return (
      <Image
        source={{ uri: file.uri }}
        resizeMode="contain"
        accessibilityLabel="Document"
        style={styles.fill}
      />
    );
  }
  return (
    <WebView
      source={{ uri: file.uri }}
      originWhitelist={['file://*']}
      allowFileAccess
      allowingReadAccessToURL={file.uri.slice(0, file.uri.lastIndexOf('/') + 1)}
      javaScriptEnabled={false}
      style={styles.fill}
      accessibilityLabel="Document viewer"
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
