import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  PmepeDetailScreen,
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
import { ScannerScreen } from '@/features/scanner/ScannerScreen';
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
import { resetTabBar, tabBarCollapse } from './tabBarCollapse';
import { useBrand } from '@/theme/brand';

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

/** The floating tab bar's own height; the screens keep clear of it (see MainTabs). */
const TAB_BAR_HEIGHT = 60;

/** Tab bar: a rounded bar floating above the bottom edge, the active tab on a light-blue pill. */
const tabOptions = {
  animation: 'fade' as const, // pages fade in when you switch tabs
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarShowLabel: false, // icons only; each tab still has its name for screen readers
  tabBarHideOnKeyboard: true,
  tabBarButton: (props: BottomTabBarButtonProps) => <TabButton {...props} />,
  tabBarItemStyle: { justifyContent: 'center' as const },
  tabBarStyle: {
    position: 'absolute' as const,
    start: 28, // the library's own style uses start/end, which win over left/right
    end: 28,
    elevation: 0, // the shadow below is drawn by boxShadow; Android's elevation would add a grey one
    height: TAB_BAR_HEIGHT,
    paddingBottom: 0,
    paddingHorizontal: 4,
    borderRadius: 34,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    boxShadow: '0 8px 24px rgba(18, 36, 61, 0.14)',
    // shrinks toward the bottom while you scroll down, grows back when you scroll up
    transform: [
      { translateY: tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
      { scale: tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
    ],
  },
};

/** A tab's button without the grey press ripple (the open tab already shows on its pill). */
function TabButton(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...(props as PressableProps)}
      android_ripple={{ color: 'transparent' }}
      style={[props.style, styles.tabCentered]} // the library lays a tab out from the top; icons only, so centre it
    />
  );
}

/** The tab's icon on a light-blue pill while its tab is open. */
function TabPill({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const brand = useBrand();
  return (
    <View
      style={[styles.pill, focused && styles.pillOn, focused && { backgroundColor: brand.infoBg }]}
    >
      {children}
    </View>
  );
}

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
      <GlyphIcon name="person" size={26} />
    </Pressable>
  );
}

function MainTabs() {
  const brand = useBrand();
  const unread = useUnreadCount(true);
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8) + 8; // the bar floats this far above the bottom edge
  return (
    <Tabs.Navigator
      screenListeners={{ focus: resetTabBar }}
      screenOptions={{
        ...headerOptions,
        headerTintColor: brand.primary,
        ...tabOptions,
        tabBarActiveTintColor: brand.primary,
        tabBarStyle: { ...tabOptions.tabBarStyle, bottom },
        sceneStyle: {
          backgroundColor: colors.background,
          paddingBottom: TAB_BAR_HEIGHT + bottom + 8,
        },
        headerRight: () => <AccountButton />,
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          headerShown: false, // the Dashboard has its own gradient header, with the Account button in it
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <TabIcon name="home" color={color} filled={focused} />
            </TabPill>
          ),
        }}
      />
      <Tabs.Screen
        name="Files"
        component={FilesScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <TabIcon name="folder" color={color} filled={focused} />
            </TabPill>
          ),
        }}
      />
      <Tabs.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          // "Announcements" does not fit under a fifth of the screen: the tab says "Notices", the screen and VoiceOver say Announcements
          tabBarLabel: 'Notices',
          tabBarAccessibilityLabel: 'Announcements',
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <TabIcon name="announce" color={color} filled={focused} />
            </TabPill>
          ),
          tabBarBadge: unread.data && unread.data > 0 ? unread.data : undefined,
        }}
      />
      <Tabs.Screen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <TabIcon name="money" color={color} filled={focused} />
            </TabPill>
          ),
        }}
      />
      <Tabs.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <TabIcon name="case" color={color} filled={focused} />
            </TabPill>
          ),
        }}
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
  const brand = useBrand();

  if (status === 'bootstrapping') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.primary} accessibilityLabel="Loading" />
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
        screenOptions={{
          ...headerOptions,
          headerTintColor: brand.primary,
          headerBackButtonDisplayMode: 'minimal',
          animation: 'fade', // pages fade in instead of sliding
          animationDuration: 250,
        }}
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
          name="Scanner"
          component={ScannerScreen}
          options={{ title: 'Scan a document' }}
        />
        <AppStack.Screen name="CallIt" component={CallItScreen} options={{ title: 'Call-it' }} />
        <AppStack.Screen
          name="CallItForm"
          component={ReportFormScreen}
          options={({ route }) => ({ title: route.params?.id ? 'Your draft' : 'New report' })}
        />
        <AppStack.Screen
          name="CallItReports"
          component={ReportsScreen}
          options={{ title: 'My reports' }}
        />
        <AppStack.Screen
          name="CallItReport"
          component={ReportScreen}
          options={{ title: 'Report' }}
        />
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
        <AppStack.Screen
          name="AstraWhys"
          component={WhysScreen}
          options={{ title: 'Root cause analysis' }}
        />
        <AppStack.Screen
          name="AstraPmepe"
          component={PmepeScreen}
          options={{ title: 'Root cause analysis' }}
        />
        <AppStack.Screen
          name="AstraPmepeDetail"
          component={PmepeDetailScreen}
          options={{ title: 'Root cause analysis' }}
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
          options={{ title: 'Military style emails' }}
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
  tabCentered: { justifyContent: 'center', alignItems: 'center' },
  pill: { width: 56, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.infoBg },
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
