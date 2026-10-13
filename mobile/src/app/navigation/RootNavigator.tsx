import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';
import type { AppStackParamList, AuthStackParamList, MainTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const placeholder = (title: string, milestone: string) =>
  function Placeholder() {
    return <PlaceholderScreen title={title} milestone={milestone} />;
  };

const LoginScreen = placeholder('Login', 'M1');
const DashboardScreen = placeholder('Dashboard', 'M2');
const FilesScreen = placeholder('Files', 'M3');
const AnnouncementsScreen = placeholder('Announcements', 'M2');
const FinanceScreen = placeholder('Finance', 'M4');

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Files" component={FilesScreen} />
      <Tabs.Screen name="Announcements" component={AnnouncementsScreen} />
      <Tabs.Screen name="Finance" component={FinanceScreen} />
    </Tabs.Navigator>
  );
}

/** Auth gate by state, never by manual navigate('Login') (docs/03 rule 1). */
export function RootNavigator() {
  const status = useSessionStore((s) => s.status);

  if (status === 'bootstrapping') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={MainTabs} />
    </AppStack.Navigator>
  );
}
