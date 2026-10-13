import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, OfflineBanner, TabIcon } from '@/components';
import { colors, fonts, spacing } from '@/constants/theme';
import { AccountScreen } from '@/features/account/AccountScreen';
import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RegisterDoneScreen } from '@/features/auth/RegisterDoneScreen';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { SelectOrganizationScreen } from '@/features/auth/SelectOrganizationScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TalaStatsScreen } from '@/features/modules/tala/TalaStatsScreen';
import { TalaCourseScreen } from '@/features/modules/tala/TalaCourseScreen';
import { TalaFlashcardsScreen } from '@/features/modules/tala/TalaFlashcardsScreen';
import { TalaQuizScreen } from '@/features/modules/tala/TalaQuizScreen';
import { TalaPdfScreen, TalaVideoScreen } from '@/features/modules/tala/TalaViewers';
import { ModuleScreen } from '@/features/modules/ModuleScreen';
import { useSessionStore } from '@/store/sessionStore';
import type { AppStackParamList, AuthStackParamList, MainTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

/** Calm headers: the surface colour, no divider line, soft heading type. */
const headerOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  contentStyle: { backgroundColor: colors.background },
};

/** Tab bar: a raised strip of the surface (shadow cast upwards), active tab in the brand blue. */
const tabOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    boxShadow: [
      { offsetX: 0, offsetY: -6, blurRadius: 16, color: colors.shadowDark },
      { offsetX: 0, offsetY: 2, blurRadius: 8, color: colors.shadowLight },
    ],
  },
};

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ ...headerOptions, ...tabOptions }}>
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon name="person" color={color} /> }}
      />
    </Tabs.Navigator>
  );
}

/** The server could not be reached while verifying a stored session: offer a retry, never a silent sign-out. */
function ConnectionProblem() {
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const signOut = useSessionStore((s) => s.signOut);
  return (
    <SafeAreaView style={styles.center}>
      <AppText variant="title" accessibilityRole="header">
        Cannot reach Sailix
      </AppText>
      <AppText muted style={styles.text}>
        Check your connection. You are still signed in.
      </AppText>
      <Button title="Try again" onPress={() => void bootstrap()} />
      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => void signOut({ revoke: false })}
      />
    </SafeAreaView>
  );
}

/** Auth gate by STATE, never by manual navigate('Login') (docs/03 rule 1). */
export function RootNavigator() {
  const status = useSessionStore((s) => s.status);

  if (status === 'bootstrapping') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }
  if (status === 'unreachable') return <ConnectionProblem />;

  if (status === 'unauthenticated') {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="SelectOrganization" component={SelectOrganizationScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="RegisterDone" component={RegisterDoneScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <AppStack.Navigator
        screenOptions={{ ...headerOptions, headerBackButtonDisplayMode: 'minimal' }}
      >
        <AppStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <AppStack.Screen
          name="Module"
          component={ModuleScreen}
          options={({ route }) => ({ title: route.params.code === 'tala' ? 'Tala' : 'Service' })}
        />
        <AppStack.Screen
          name="TalaStats"
          component={TalaStatsScreen}
          options={{ title: 'My stats' }}
        />
        <AppStack.Screen
          name="TalaCourse"
          component={TalaCourseScreen}
          options={{ title: 'My Courses' }}
        />
        <AppStack.Screen
          name="TalaFlashcards"
          component={TalaFlashcardsScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <AppStack.Screen
          name="TalaQuiz"
          component={TalaQuizScreen}
          options={{ title: 'My Courses' }}
        />
        <AppStack.Screen
          name="TalaPdf"
          component={TalaPdfScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <AppStack.Screen
          name="TalaVideo"
          component={TalaVideoScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <AppStack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ title: 'Change password' }}
        />
      </AppStack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  text: { textAlign: 'center' },
});
