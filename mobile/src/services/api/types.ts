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
