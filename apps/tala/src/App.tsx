import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { Quicksand_600SemiBold, Quicksand_700Bold, useFonts } from '@expo-google-fonts/quicksand';
import { talaModule, type TalaHost } from '@sailix/tala';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { readTalaConfig } from './config';

/**
 * The standalone Tala app: a thin shell around the Tala package. The package owns sign-in, the team choice, the tabs and
 * every screen; this adds the fonts the package draws with and, later, extra tabs of its own (`extraTabs`).
 */
export function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  // one stable host for the life of the app: the package restarts when its host changes
  const host = useMemo<TalaHost>(
    () => ({
      scope: '', // the package scopes everything by Tala user and team itself
      theme: { background: '#F4F8FC', text: '#0F2036', primary: '#1260D8' },
      config: readTalaConfig(Constants.expoConfig?.extra),
    }),
    [],
  );
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <talaModule.Root host={host} />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
