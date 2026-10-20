import type { components } from './schema';

/** API types come from the OpenAPI contract (contracts/openapi.yaml → `npm run gen:api`). */
export type Schemas = components['schemas'];
export type Me = Schemas['Me'];
export type MyModule = Schemas['MyModule'];
export type MembershipSummary = Schemas['MembershipSummary'];
export type TokenGrant = Schemas['TokenGrant'];
export type SelectionRequired = Schemas['SelectionRequired'];
export type Profile = Schemas['Profile'];
export type Announcement = Schemas['Announcement'];
export type Todo = Schemas['Todo'];
export type DocumentType = Schemas['DocumentType'];
export type DocumentRequestItem = Schemas['DocumentRequestItem'];
export type CallItReport = Schemas['CallItReport'];
export type CallItReportInput = Schemas['CallItReportInput'];
export type CallItStats = Schemas['CallItStats'];
export type CallItReportList = Omit<Schemas['CallItReportPage'], 'data'> & { data: CallItReport[] };
export type CrewDocument = Schemas['CrewDocument'];
export type FinanceStatus = Schemas['FinanceStatus'];
export type PayslipSummary = Schemas['PayslipSummary'];
export type PayslipDetail = Schemas['PayslipDetail'];
export type Loan = Schemas['Loan'];
export type LoanList = Omit<Schemas['LoanList'], 'data'> & { data: Loan[] };
export type MemberDocumentList = Omit<Schemas['MemberDocumentList'], 'data'> & {
  data: CrewDocument[];
};
/** `data` is narrowed from the generated unknown[] (allOf with the generic envelope). */
export type MemberTodoPage = Omit<Schemas['MemberTodoPage'], 'data'> & { data: Todo[] };
/** The generated page type keeps `data` as unknown[] (allOf with the generic envelope), so it is narrowed here. */
export type MemberAnnouncementPage = Omit<Schemas['MemberAnnouncementPage'], 'data'> & {
  data: Announcement[];
};
export type TalaCourse = Schemas['TalaCourse'];
export type TalaCourseDetail = Schemas['TalaCourseDetail'];
export type TalaMaterialSummary = Schemas['TalaMaterialSummary'];
export type TalaMaterial = Schemas['TalaMaterial'];
export type TalaQuiz = Schemas['TalaQuiz'];
export type TalaQuizResult = Schemas['TalaQuizResult'];
export type TalaDeck = Schemas['TalaDeck'];
export type TalaFlashcardResult = Schemas['TalaFlashcardResult'];

export interface Envelope<T> {
  data: T;
}
