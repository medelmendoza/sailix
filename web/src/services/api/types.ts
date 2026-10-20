import type { components } from './schema';

/** API types come from the OpenAPI contract (contracts/openapi.yaml → `npm run gen:api`). */
export type Schemas = components['schemas'];
export type Me = Schemas['Me'];
export type Membership = Schemas['Membership'];
export type Profile = Schemas['Profile'];
export type Tenant = Schemas['Tenant'];
export type TenantStatus = Schemas['TenantStatus'];
export type TenantDetail = Schemas['TenantDetail'];
export type TenantModule = Schemas['TenantModule'];
export type PlatformTenantModule = Schemas['PlatformTenantModule'];
export type AuditEntry = Schemas['AuditEntry'];
export type DeletionRequest = Schemas['DeletionRequest'];
export type Feedback = Schemas['Feedback'];
export type Announcement = Schemas['Announcement'];
export type Todo = Schemas['Todo'];
export type Crew = Schemas['Crew'];
export type CrewUpdate = Schemas['CrewUpdate'];
export type CrewDocumentRow = Schemas['CrewDocumentRow'];
export type DocumentType = Schemas['DocumentType'];
export type CallItReport = Schemas['CallItReport'];
export type FinanceImportResult = Schemas['FinanceImportResult'];
export type CrewDocument = Schemas['CrewDocument'];
export type AnnouncementInput = Schemas['AnnouncementInput'];
export type PlatformAdmin = Schemas['PlatformAdminWithAbilities'];
export type MyModule = Schemas['MyModule'];

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page?: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
  links: Record<string, unknown>;
}

export interface ListParams {
  page?: number;
  per_page?: number;
  [filter: string]: string | number | undefined;
}
