import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/app/navigation/RootNavigator';
import { queryClient } from '@/services/queryClient';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderInProviders(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>{ui}</NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** The real app tree (auth gate included) without fonts and native bootstrap. */
export function renderApp() {
  return renderInProviders(<RootNavigator />);
}
