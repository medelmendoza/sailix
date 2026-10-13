import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MembershipSummary } from '@/services/api/types';

export type AuthStackParamList = {
  Login: undefined;
  SelectOrganization: { ticket: string; memberships: MembershipSummary[] };
  Register: undefined;
  RegisterDone: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Account: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Module: { code: string };
  ChangePassword: undefined;
};
