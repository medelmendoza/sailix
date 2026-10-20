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
    /** Already completed (or waiting to be sent): nothing left to do on the video page. */
    completed: boolean;
  };
  Account: undefined;
  Todos: undefined;
  AstraMenu: undefined;
  AstraPomodoro: undefined;
  AstraNoise: undefined;
  AstraSound: { id: string };
  AstraRisk: undefined;
  AstraRca: undefined;
  AstraWhys: undefined;
  AstraPmepe: undefined;
  AstraPmepeDetail: undefined;
  AstraScaril: undefined;
  AstraEmails: undefined;
  AstraEmailStep: { step: 'to-cc' | 'raid' | 'bluf' | 'next' };
  AstraDoc: { doc: 'bluf' | 'pmepe' | 'scaril' };
  Document: { id: string };
  DocumentForm: { id?: string; typeId?: string };
  DocumentViewer: { id: string; name: string; source?: 'document' | 'callit' };
  Scanner: undefined;
  CallIt: undefined;
  CallItForm: { id?: string };
  CallItReports: undefined;
  CallItReport: { id: string };
  PayslipList: { kind: 'allotment' | 'final' };
  Payslip: { id: string };
  Loans: undefined;
  Announcement: { id: string };
  ChangePassword: undefined;
  SendFeedback: undefined;
  TalaJoinCourse: undefined;
};
