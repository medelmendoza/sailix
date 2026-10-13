import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { Quicksand_600SemiBold, Quicksand_700Bold, useFonts } from '@expo-google-fonts/quicksand';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { syncOutbox } from '@/features/modules/tala/offline/outbox';
import { env } from '@/app/config/env';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';

export function AppProviders({ children }: { children: ReactNode }) {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  const bootstrap = useSessionStore((s) => s.bootstrap);

  useEffect(() => {
    if (!env.demo) void bootstrap(); // demo mode starts signed in with sample data
  }, [bootstrap]);

  // Back in the foreground: rotate the token when it is close to expiry and pick up changes such as a
  // module being switched on for the organization. Never blocks the UI; failures are silent.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const session = useSessionStore.getState();
      if (state === 'active' && session.status === 'authenticated') {
        void session.refreshTokenIfNeeded();
        void session.refreshMe().catch(() => undefined);
        void syncOutbox().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, []);

  // Connection regained: deliver completions recorded while offline.
  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && useSessionStore.getState().status === 'authenticated') {
        void syncOutbox().catch(() => undefined);
      }
    });
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
