import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { RootNavigator } from './navigation/RootNavigator';
import { env } from '@/app/config/env';
import { ErrorBoundary } from '@/components';
import { colors } from '@/constants/theme';
import { DemoTour } from '@/demo/DemoTour';
import { installDemo } from '@/demo/demoApi';
import { installGlobalCrashHandler } from '@/services/crashReporter';
import { navigationRef } from './navigation/navigationRef';
import { AppProviders } from './providers/AppProviders';
import { useBrand } from '@/theme/brand';

/** The navigator's own backgrounds follow the app surface, so nothing flashes white between screens. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    primary: colors.primary,
    border: 'transparent',
  },
};

// Demo mode (build-time, never in production): sample data instead of the network, and a scripted tour of the screens.
if (env.demo) installDemo();
installGlobalCrashHandler();

export default function App() {
  const brand = useBrand();
  const theme = useMemo(
    () => ({
      ...navigationTheme,
      colors: { ...navigationTheme.colors, primary: brand.primary, text: brand.text },
    }),
    [brand.primary, brand.text],
  );
  return (
    <ErrorBoundary>
      <AppProviders>
        <NavigationContainer ref={navigationRef} theme={theme}>
          <RootNavigator />
          {env.demo && env.demoTour ? <DemoTour /> : null}
          <StatusBar style="auto" />
        </NavigationContainer>
      </AppProviders>
    </ErrorBoundary>
  );
}
