import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './navigation/RootNavigator';
import { env } from '@/app/config/env';
import { colors } from '@/constants/theme';
import { DemoTour } from '@/demo/DemoTour';
import { installDemo } from '@/demo/demoApi';
import { navigationRef } from './navigation/navigationRef';
import { AppProviders } from './providers/AppProviders';

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

export default function App() {
  return (
    <AppProviders>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <RootNavigator />
        {env.demo ? <DemoTour /> : null}
        <StatusBar style="auto" />
      </NavigationContainer>
    </AppProviders>
  );
}
