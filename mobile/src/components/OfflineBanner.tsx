import { useNetInfo } from '@react-native-community/netinfo';
import { Notice } from './Notice';

/** Shown only when the device reports no connection; data screens keep showing what they have. */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  return isConnected === false ? <Notice tone="warning" message="You are offline." /> : null;
}
