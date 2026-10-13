import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Files: undefined;
  Announcements: undefined;
  Finance: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};
