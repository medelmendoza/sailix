import { useNetInfo } from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { Notice } from './Notice';

/**
 * Shown only when the device reports no connection; data screens keep showing what they have. It brings its own top inset,
 * and only while visible (an always-present inset would add an empty band above every screen's own header).
 */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
      <Notice tone="warning" message="You are offline." />
    </SafeAreaView>
  );
}
