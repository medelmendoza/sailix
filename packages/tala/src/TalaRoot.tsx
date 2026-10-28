import NetInfo from '@react-native-community/netinfo';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  NavigationIndependentTree,
  createNavigationContainerRef,
  type ParamListBase,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  View,
  type PressableProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDirectSource } from './data/source';
import { createTalaSession, secureStoreStorage } from './direct/auth';
import { TalaError, createTalaClient } from './direct/client';
import { HostContext, useHost, type TalaHost } from './host';
import { wipeOfflineData } from './offline/wipe';
import { syncOutbox } from './offline/outbox';
import type { TalaRoutes } from './routes';
import { makeScope, setRuntime, setScope, type TalaRuntime } from './runtime';
import { TalaCourseList } from './screens/TalaCourseList';
import { TalaAccountScreen } from './screens/TalaAccountScreen';
import { TalaCourseScreen } from './screens/TalaCourseScreen';
import { TalaCourseStatsScreen } from './screens/TalaCourseStatsScreen';
import { TalaDashboard } from './screens/TalaDashboard';
import { TalaDrillScreen } from './screens/TalaDrillScreen';
import { TalaFlashcardsScreen } from './screens/TalaFlashcardsScreen';
import { TalaJoinCourseScreen } from './screens/TalaJoinCourseScreen';
import { TalaQuizScreen } from './screens/TalaQuizScreen';
import { TalaSignIn } from './screens/TalaSignIn';
import { TalaStatsScreen } from './screens/TalaStatsScreen';
import { TalaPdfScreen, TalaVideoScreen } from './screens/TalaViewers';
import { AppText, Button, Card, EmptyState, FormScreen, GlyphIcon, type GlyphName } from './ui';
import { useBrand } from './ui/brand';
import { resetTabBar, tabBarCollapse } from './ui/tabBarCollapse';
import { spacing } from './ui/theme';

/** A tab the app that mounts Tala adds after Tala's own (the standalone app's extra tab). */
export interface ExtraTab {
  name: string;
  title: string;
  icon: GlyphName;
  component: ComponentType;
}

type Team = { id: string; name: string };
type State =
  | { step: 'loading' }
  | { step: 'signedOut'; expired: boolean }
  | { step: 'pickTeam'; teams: Team[] }
  | { step: 'ready'; teams: Team[]; teamId: string };

let runtimes = 0;
const Stack = createNativeStackNavigator<TalaRoutes>();
const Tabs = createBottomTabNavigator<Record<string, undefined>>();
const navRef = createNavigationContainerRef<ParamListBase>();

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <FormScreen>
      <EmptyState title={title} description={description} />
    </FormScreen>
  );
}

function TeamPicker({ teams, onPick }: { teams: Team[]; onPick: (id: string) => void }) {
  return (
    <FormScreen>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading" accessibilityRole="header">
          Choose your team
        </AppText>
        {teams.map((t) => (
          <Button key={t.id} title={t.name} variant="secondary" onPress={() => onPick(t.id)} />
        ))}
      </Card>
    </FormScreen>
  );
}

/** The mini app of the Tala service: sign-in, team, tabs and the course screens. Mounted by Sailix and by the standalone app. */
export function TalaRoot({ host, extraTabs = [] }: { host: TalaHost; extraTabs?: ExtraTab[] }) {
  const rt = useMemo(() => {
    try {
      const session = createTalaSession(secureStoreStorage, host.scope);
      const client = createTalaClient(
        { baseUrl: host.config.talaBaseUrl, onUnauthorized: () => void session.expire() },
        () => session.token(),
      );
      const runtime: TalaRuntime = {
        id: ++runtimes,
        host,
        session,
        client,
        source: createDirectSource(client, session, host.config.progressWrites),
        queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        scope: null,
      };
      setRuntime(runtime);
      return runtime;
    } catch {
      return null;
    }
  }, [host]);

  if (!rt) {
    return (
      <HostContext.Provider value={host}>
        <Notice title="Lodestar is not available" description="Lodestar is not set up for this app." />
      </HostContext.Provider>
    );
  }
  return (
    <HostContext.Provider value={host}>
      <QueryClientProvider client={rt.queryClient}>
        <Gate key={rt.id} rt={rt} extraTabs={extraTabs} />
      </QueryClientProvider>
    </HostContext.Provider>
  );
}

function Gate({ rt, extraTabs }: { rt: TalaRuntime; extraTabs: ExtraTab[] }) {
  const { host, session, client, queryClient } = rt;
  const [state, setState] = useState<State>({ step: 'loading' });
  const [message, setMessage] = useState<string | null>(null);

  /** The teams this account may use here: only the organization's own team when the host has one. */
  const usableTeams = useCallback(
    async (userId: string): Promise<Team[]> => {
      const all: Team[] = await client.teams(userId);
      return host.config.teamId ? all.filter((t) => t.id === host.config.teamId) : all;
    },
    [client, host.config.teamId],
  );

  const enter = useCallback(
    async (userId: string, teamId: string, teams: Team[]) => {
      await session.setTeam(teamId);
      setScope(rt, makeScope(host.scope, userId, teamId));
      setState({ step: 'ready', teams, teamId });
    },
    [host.scope, rt, session],
  );

  /** Works out where a signed-in account goes next: its team, a choice of teams, or nowhere. */
  const resolve = useCallback(
    async (userId: string, saved: string | null) => {
      const teams = await usableTeams(userId);
      if (teams.length === 0) {
        await session.signOut();
        setMessage(
          host.config.teamId
            ? "This Lodestar account does not belong to your organization's team."
            : 'This Lodestar account is not in any team.',
        );
        setState({ step: 'signedOut', expired: false });
      } else if (saved && teams.some((t) => t.id === saved)) {
        await enter(userId, saved, teams);
      } else if (teams.length === 1) {
        await enter(userId, teams[0]!.id, teams);
      } else {
        setState({ step: 'pickTeam', teams });
      }
    },
    [enter, host.config.teamId, session, usableTeams],
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      const s = await session.current();
      if (!live) return;
      if (!s) return setState({ step: 'signedOut', expired: false });
      try {
        await resolve(s.userId, s.teamId);
      } catch (e) {
        // Tala unreachable at start-up: keep the session; the saved courses still open once a team is known
        if (e instanceof TalaError && e.kind === 'unauthorized') return;
        if (live && s.teamId) await enter(s.userId, s.teamId, []);
        else if (live) setState({ step: 'signedOut', expired: false });
      }
    })();
    const off = session.onSignInAgain(() => {
      setScope(rt, null);
      queryClient.clear();
      setState({ step: 'signedOut', expired: true });
    });
    return () => {
      live = false;
      off();
    };
  }, [enter, queryClient, resolve, rt, session]);

  // Deliver what was done offline once signed in, back in the foreground, and when the connection returns.
  const ready = state.step === 'ready';
  useEffect(() => {
    if (!ready) return;
    const run = () => void syncOutbox().catch(() => undefined);
    run();
    const app = AppState.addEventListener('change', (s) => s === 'active' && run());
    const net = NetInfo.addEventListener((s) => s.isConnected && run());
    return () => {
      app.remove();
      net();
    };
  }, [ready]);

  async function signIn(username: string, password: string) {
    setMessage(null);
    const { userId } = await session.signIn(client, username, password);
    await resolve(userId, null);
  }

  async function signOut() {
    const scope = rt.scope;
    setScope(rt, null);
    await session.signOut();
    queryClient.clear();
    if (scope) await wipeOfflineData(scope);
    setState({ step: 'signedOut', expired: false });
  }

  async function switchTeam() {
    const s = await session.current();
    if (s && state.step === 'ready') {
      setScope(rt, null);
      queryClient.clear();
      setState({ step: 'pickTeam', teams: state.teams });
    }
  }

  if (state.step === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.step === 'signedOut') {
    return (
      <>
        {message ? <Notice title="Cannot use this account" description={message} /> : null}
        {message ? null : <TalaSignIn expired={state.expired} onSignIn={signIn} />}
        {message ? <Button title="Try another account" onPress={() => setMessage(null)} /> : null}
      </>
    );
  }
  if (state.step === 'pickTeam') {
    return (
      <TeamPicker
        teams={state.teams}
        onPick={(id) =>
          void session.current().then((s) => s && enter(s.userId, id, state.teams))
        }
      />
    );
  }
  return (
    <Navigation
      extraTabs={extraTabs}
      teamName={state.teams.find((t) => t.id === state.teamId)?.name ?? null}
      canSwitchTeam={state.teams.length > 1}
      onSwitchTeam={() => void switchTeam()}
      onSignOut={() => void signOut()}
    />
  );
}

const Courses = () => <TalaCourseList />;

const TAB_BAR_HEIGHT = 60;

/** The tab's icon on a light pill while its tab is open (the same floating bar as Sailix's own tabs). */
function TabPill({ focused, children }: { focused: boolean; children: ReactNode }) {
  const brand = useBrand();
  return (
    <View
      style={{
        width: 52,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? brand.infoBg : 'transparent',
      }}
    >
      {children}
    </View>
  );
}

function TabsScreen({ extraTabs }: { extraTabs: ExtraTab[] }) {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8) + 8; // the bar floats this far above the bottom edge
  const own: { name: string; title: string; icon: GlyphName; component: ComponentType }[] = [
    { name: 'TalaDashboard', title: 'Dashboard', icon: 'grid', component: TalaDashboard },
    { name: 'TalaCourses', title: 'My Courses', icon: 'book', component: Courses },
    { name: 'TalaStats', title: 'Stats', icon: 'chart', component: TalaStatsScreen },
  ];
  return (
    <Tabs.Navigator
      screenListeners={{ focus: resetTabBar }}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: brand.textMuted,
        tabBarShowLabel: false, // icons only; each tab still has its name for screen readers
        tabBarHideOnKeyboard: true,
        tabBarButton: (props) => (
          <Pressable
            {...(props as PressableProps)}
            android_ripple={{ color: 'transparent' }}
            style={[props.style, { justifyContent: 'center', alignItems: 'center' }]}
          />
        ),
        tabBarItemStyle: { justifyContent: 'center' },
        tabBarStyle: {
          position: 'absolute',
          start: 28,
          end: 28,
          bottom,
          elevation: 0,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          paddingHorizontal: 4,
          borderRadius: 34,
          borderTopWidth: 0,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(18, 36, 61, 0.14)',
          // shrinks toward the bottom while you scroll down, grows back when you scroll up (as Sailix's bar does)
          transform: [
            { translateY: tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
            { scale: tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
          ],
        },
        sceneStyle: { backgroundColor: brand.background, paddingBottom: TAB_BAR_HEIGHT + bottom + 8 },
      }}
    >
      {[...own, ...extraTabs].map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <TabPill focused={focused}>
                <GlyphIcon name={t.icon} color={color} size={22} />
              </TabPill>
            ),
          }}
        />
      ))}
    </Tabs.Navigator>
  );
}

function Navigation({
  extraTabs,
  teamName,
  canSwitchTeam,
  onSwitchTeam,
  onSignOut,
}: {
  extraTabs: ExtraTab[];
  teamName: string | null;
  canSwitchTeam: boolean;
  onSwitchTeam: () => void;
  onSignOut: () => void;
}) {
  const h = useHost();
  const brand = useBrand();
  return (
    <NavigationIndependentTree>
        <NavigationContainer ref={navRef}>
          <BackToHost onExit={h.onExit} />
          <Stack.Navigator>
            <Stack.Screen
              name="TalaTabs"
              options={{
                title: 'Lodestar',
                headerBackVisible: false,
                headerLeft: h.onExit
                  ? () => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        onPress={h.onExit}
                        hitSlop={12}
                        style={{ paddingRight: 16 }}
                      >
                        <AppText style={{ fontSize: 24 }}>←</AppText>
                      </Pressable>
                    )
                  : undefined,
                headerRight: () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Account"
                    onPress={() => navRef.isReady() && navRef.navigate('TalaAccount')}
                    hitSlop={8}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: brand.primary,
                    }}
                  >
                    <GlyphIcon name="person" color="#FFFFFF" size={20} />
                  </Pressable>
                ),
              }}
            >
              {() => <TabsScreen extraTabs={extraTabs} />}
            </Stack.Screen>
            <Stack.Screen name="TalaAccount" options={{ title: 'Account' }}>
              {() => (
                <TalaAccountScreen
                  teamName={teamName}
                  canSwitchTeam={canSwitchTeam}
                  onSwitchTeam={onSwitchTeam}
                  onSignOut={onSignOut}
                  onExit={h.onExit}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="TalaJoinCourse" component={TalaJoinCourseScreen} options={{ title: 'Join a course' }} />
            <Stack.Screen name="TalaDrill" component={TalaDrillScreen} options={({ route }) => ({ title: route.params.title })} />
            <Stack.Screen name="TalaCourseStats" component={TalaCourseStatsScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="TalaCourse" component={TalaCourseScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="TalaFlashcards" component={TalaFlashcardsScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="TalaQuiz" component={TalaQuizScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="TalaPdf" component={TalaPdfScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="TalaVideo" component={TalaVideoScreen} options={({ route }) => ({ title: route.params.name })} />
          </Stack.Navigator>
        </NavigationContainer>
    </NavigationIndependentTree>
  );
}

/** Hardware back inside the package: step back through its screens, then hand control back to the host. */
function BackToHost({ onExit }: { onExit?: () => void }) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navRef.isReady() && navRef.canGoBack()) {
        navRef.goBack();
        return true;
      }
      if (onExit) {
        onExit();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onExit]);
  return null;
}
