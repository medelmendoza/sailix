import type { components } from './schema';

/** API types come from the OpenAPI contract (contracts/openapi.yaml → `npm run gen:api`). */
export type Schemas = components['schemas'];
export type Me = Schemas['Me'];
export type MyModule = Schemas['MyModule'];
export type MembershipSummary = Schemas['MembershipSummary'];
export type TokenGrant = Schemas['TokenGrant'];
export type SelectionRequired = Schemas['SelectionRequired'];
export type Profile = Schemas['Profile'];
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
