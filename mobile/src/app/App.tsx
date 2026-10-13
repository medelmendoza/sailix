import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './navigation/RootNavigator';
import { AppProviders } from './providers/AppProviders';

export default function App() {
  return (
    <AppProviders>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </AppProviders>
  );
}
