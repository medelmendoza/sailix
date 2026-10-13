import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';

export function AppProviders({ children }: { children: ReactNode }) {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  const bootstrap = useSessionStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
