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
  const { id } = route.params;
  const [file, setFile] = useState<{ uri: string; image: boolean } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFile(null);
    setError(null);
    downloadToCache(id)
      .then((f) => {
        if (alive) setFile({ uri: f.uri, image: /\.(jpe?g|png)$/i.test(f.uri) });
      })
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
      removeFromCache(id);
    };
  }, [id, attempt]);

  if (error) {
    return <ErrorState message={describeError(error)} onRetry={() => setAttempt((n) => n + 1)} />;
  }
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
