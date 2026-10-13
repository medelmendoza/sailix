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
  Files: undefined;
  Announcements: undefined;
  Finance: undefined;
  Services: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Module: { code: string };
  TalaStats: undefined;
  TalaCourse: { assignId: string; name: string };
  TalaFlashcards: {
    assignId: string;
    cardId: string;
    name: string;
    /** Demo builds only (ignored otherwise): open with the answer side showing, for screenshots. */
    preview?: 'answer';
  };
  TalaQuiz: { assignId: string; quizId: string; name: string };
  TalaPdf: { name: string; uri: string };
  TalaVideo: {
    name: string;
    uri: string;
    assignId: string;
    materialId: string;
    canComplete: boolean;
  };
  Account: undefined;
  Todos: undefined;
  Announcement: { id: string };
  ChangePassword: undefined;
  SendFeedback: undefined;
  TalaJoinCourse: undefined;
};
