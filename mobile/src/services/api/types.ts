import type { components } from './schema';

/** API types come from the OpenAPI contract (contracts/openapi.yaml → `npm run gen:api`). */
export type Schemas = components['schemas'];
export type Me = Schemas['Me'];
export type MyModule = Schemas['MyModule'];
export type MembershipSummary = Schemas['MembershipSummary'];
export type TokenGrant = Schemas['TokenGrant'];
export type SelectionRequired = Schemas['SelectionRequired'];
export type Profile = Schemas['Profile'];

export interface Envelope<T> {
  data: T;
}
