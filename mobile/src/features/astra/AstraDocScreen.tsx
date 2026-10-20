import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AppStackParamList } from '@/app/navigation/types';
import { ErrorState } from '@/components';
import { colors } from '@/constants/theme';
import { useBrand } from '@/theme/brand';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraDoc'>;

const FILES = {
  bluf: require('../../../assets/astra/pdfs/bluf.pdf'),
  pmepe: require('../../../assets/astra/pdfs/pmepe.pdf'),
  scaril: require('../../../assets/astra/pdfs/scaril.pdf'),
} as const;

/** One of the three guides bundled with the app, shown from the app's own files (nothing is downloaded). */
export function AstraDocScreen({ route }: Props) {
  const brand = useBrand();
  const { doc } = route.params;
  const [state, setState] = useState<{ doc: string; uri?: string; failed?: boolean } | null>(null);
  const current = state?.doc === doc ? state : null;

  useEffect(() => {
    let alive = true;
    Asset.fromModule(FILES[doc])
      .downloadAsync()
      .then((a) => alive && setState({ doc, uri: a.localUri ?? a.uri }))
      .catch(() => alive && setState({ doc, failed: true }));
    return () => {
      alive = false;
    };
  }, [doc]);

  if (current?.failed) return <ErrorState message="This guide could not be opened." />;
  if (!current?.uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.primary} accessibilityLabel="Opening the guide" />
      </View>
    );
  }
  return (
    <WebView
      source={{ uri: current.uri }}
      originWhitelist={['file://*']}
      allowFileAccess
      allowingReadAccessToURL={current.uri.slice(0, current.uri.lastIndexOf('/') + 1)}
      javaScriptEnabled={false}
      style={styles.fill}
      accessibilityLabel="Guide"
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
