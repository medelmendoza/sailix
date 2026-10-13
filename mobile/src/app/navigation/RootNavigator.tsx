import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, GlyphIcon, OfflineBanner, TabIcon } from '@/components';
import { colors, fonts, spacing } from '@/constants/theme';
import { TodosScreen } from '@/features/todos/TodosScreen';
import { AnnouncementScreen } from '@/features/announcements/AnnouncementScreen';
import { AnnouncementsScreen } from '@/features/announcements/AnnouncementsScreen';
import { useUnreadCount } from '@/features/announcements/api';
import { AstraDocScreen } from '@/features/astra/AstraDocScreen';
import { AstraMenuScreen } from '@/features/astra/AstraMenuScreen';
import { NoiseScreen } from '@/features/astra/NoiseScreen';
import { PomodoroScreen } from '@/features/astra/PomodoroScreen';
import { SoundScreen } from '@/features/astra/SoundScreen';
import {
  EmailsScreen,
  EmailStepScreen,
  PmepeScreen,
  RcaScreen,
  RiskScreen,
  ScarilScreen,
  WhysScreen,
} from '@/features/astra/StaticScreens';
import { CallItScreen } from '@/features/callit/CallItScreen';
import { ReportFormScreen } from '@/features/callit/ReportFormScreen';
import { ReportScreen } from '@/features/callit/ReportScreen';
import { ReportsScreen } from '@/features/callit/ReportsScreen';
import { DocumentFormScreen } from '@/features/files/DocumentFormScreen';
import { DocumentScreen } from '@/features/files/DocumentScreen';
import { DocumentViewerScreen } from '@/features/files/DocumentViewerScreen';
import { FilesScreen } from '@/features/files/FilesScreen';
import { FinanceScreen } from '@/features/finance/FinanceScreen';
import { LoansScreen } from '@/features/finance/LoansScreen';
import { PayslipListScreen } from '@/features/finance/PayslipListScreen';
import { PayslipScreen } from '@/features/finance/PayslipScreen';
import { ServicesScreen } from '@/features/services/ServicesScreen';
import { AccountScreen } from '@/features/account/AccountScreen';
import { ChangePasswordScreen } from '@/features/account/ChangePasswordScreen';
import { SendFeedbackScreen } from '@/features/account/SendFeedbackScreen';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RegisterDoneScreen } from '@/features/auth/RegisterDoneScreen';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { SelectOrganizationScreen } from '@/features/auth/SelectOrganizationScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TalaJoinCourseScreen } from '@/features/modules/tala/TalaJoinCourseScreen';
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
  tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
};

/** The old Sailix "settings menu": reachable from every tab's header. */
function AccountButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      onPress={() => navigation.navigate('Account')}
      hitSlop={8}
      style={styles.accountButton}
    >
      <GlyphIcon name="person" color={colors.primary} size={26} />
    </Pressable>
  );
}

function MainTabs() {
  const unread = useUnreadCount(true);
  return (
    <Tabs.Navigator
      screenOptions={{ ...headerOptions, ...tabOptions, headerRight: () => <AccountButton /> }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Files"
        component={FilesScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon name="folder" color={color} /> }}
      />
      <Tabs.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          // "Announcements" does not fit under a fifth of the screen: the tab says "Notices", the screen and VoiceOver say Announcements
          tabBarLabel: 'Notices',
          tabBarAccessibilityLabel: 'Announcements',
          tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} />,
          tabBarBadge: unread.data && unread.data > 0 ? unread.data : undefined,
        }}
      />
      <Tabs.Screen
        name="Finance"
        component={FinanceScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon name="coins" color={color} /> }}
      />
      <Tabs.Screen
        name="Services"
        component={ServicesScreen}
        options={{ tabBarIcon: ({ color }) => <TabIcon name="grid" color={color} /> }}
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
          name="TalaJoinCourse"
          component={TalaJoinCourseScreen}
          options={{ title: 'Join a course' }}
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
        <AppStack.Screen
          name="Document"
          component={DocumentScreen}
          options={{ title: 'Document' }}
        />
        <AppStack.Screen
          name="DocumentForm"
          component={DocumentFormScreen}
          options={({ route }) => ({ title: route.params?.id ? 'Send again' : 'Add a document' })}
        />
        <AppStack.Screen
          name="DocumentViewer"
          component={DocumentViewerScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <AppStack.Screen
          name="PayslipList"
          component={PayslipListScreen}
          options={({ route }) => ({
            title: route.params.kind === 'final' ? 'Final pay' : 'Allotment',
          })}
        />
        <AppStack.Screen name="Payslip" component={PayslipScreen} options={{ title: 'Payslip' }} />
        <AppStack.Screen name="Loans" component={LoansScreen} options={{ title: 'Cash advance' }} />
        <AppStack.Screen
          name="AstraMenu"
          component={AstraMenuScreen}
          options={{ title: 'Astra' }}
        />
        <AppStack.Screen
          name="AstraPomodoro"
          component={PomodoroScreen}
          options={{ title: 'Pomodoro' }}
        />
        <AppStack.Screen
          name="AstraNoise"
          component={NoiseScreen}
          options={{ title: 'Focus and Rest' }}
        />
        <AppStack.Screen name="AstraSound" component={SoundScreen} options={{ title: 'Sound' }} />
        <AppStack.Screen
          name="AstraRisk"
          component={RiskScreen}
          options={{ title: 'Risk management' }}
        />
        <AppStack.Screen
          name="AstraRca"
          component={RcaScreen}
          options={{ title: 'Root cause analysis' }}
        />
        <AppStack.Screen name="AstraWhys" component={WhysScreen} options={{ title: '5 Whys' }} />
        <AppStack.Screen
          name="AstraPmepe"
          component={PmepeScreen}
          options={{ title: 'P.M.E.P.E' }}
        />
        <AppStack.Screen
          name="AstraScaril"
          component={ScarilScreen}
          options={{ title: 'SCARIL' }}
        />
        <AppStack.Screen
          name="AstraEmails"
          component={EmailsScreen}
          options={{ title: 'Military style emails' }}
        />
        <AppStack.Screen
          name="AstraEmailStep"
          component={EmailStepScreen}
          options={{ title: 'Email steps' }}
        />
        <AppStack.Screen name="AstraDoc" component={AstraDocScreen} options={{ title: 'Guide' }} />
        <AppStack.Screen name="Todos" component={TodosScreen} options={{ title: 'To-do list' }} />
        <AppStack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
        <AppStack.Screen
          name="Announcement"
          component={AnnouncementScreen}
          options={{ title: 'Announcement' }}
        />
        <AppStack.Screen
          name="SendFeedback"
          component={SendFeedbackScreen}
          options={{ title: 'Send feedback' }}
        />
      </AppStack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  accountButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
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
