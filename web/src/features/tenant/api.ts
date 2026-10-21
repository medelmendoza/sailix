import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useToast } from '../../components/ui';
import { api } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import type {
  Announcement,
  AnnouncementInput,
  AuditEntry,
  CallItReport,
  Crew,
  CrewDocument,
  CrewDocumentRow,
  CrewUpdate,
  DocumentType,
  DeletionRequest,
  Envelope,
  Feedback,
  FinanceImportResult,
  ListParams,
  Membership,
  Page,
  PublicTenant,
  TenantDetail,
  TenantDomain,
  BrandingInput,
  Todo,
  TenantModule,
} from '../../services/api/types';
import { TENANT_SESSION } from '../authentication/session';

export function useMembers(params: ListParams) {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async () => (await api.get<Page<Membership>>('/tenant/users', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useMemberCount(status: string) {
  return useQuery({
    queryKey: ['member-count', status],
    queryFn: async () =>
      (
        await api.get<Page<Membership>>('/tenant/users', {
          params: { 'filter[status]': status, per_page: 1 },
        })
      ).data.meta.total,
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { status?: 'active' | 'suspended'; role?: 'tenant_admin' | 'crew' };
    }) => (await api.patch<Envelope<Membership>>(`/tenant/users/${id}`, patch)).data.data,
    onSuccess: () => {
      toast.success('Member updated.');
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['crew'] });
      void qc.invalidateQueries({ queryKey: ['crew-member'] });
      void qc.invalidateQueries({ queryKey: ['member-count'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useCrewList(params: ListParams) {
  return useQuery({
    queryKey: ['crew', params],
    queryFn: async () => (await api.get<Page<Crew>>('/tenant/crew', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useCrewMember(id: string) {
  return useQuery({
    queryKey: ['crew-member', id],
    queryFn: async () => (await api.get<Envelope<Crew>>(`/tenant/crew/${id}`)).data.data,
  });
}

export function useUpdateCrew(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: CrewUpdate) =>
      (await api.patch<Envelope<Crew>>(`/tenant/crew/${id}`, patch)).data.data,
    onSuccess: (crew) => {
      qc.setQueryData(['crew-member', id], crew);
      void qc.invalidateQueries({ queryKey: ['crew'] });
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useCrewDocuments(id: string) {
  return useQuery({
    queryKey: ['crew-documents', id],
    queryFn: async () =>
      (await api.get<Envelope<CrewDocumentRow[]>>(`/tenant/crew/${id}/documents`)).data.data,
  });
}

/** The pictures an organization can set: shown in the portal, the browser tab and on the sign-in page. */
export type BrandingImageKind = 'logo' | 'favicon' | 'login-logo' | 'login-background';

/** Tick or untick "ask this member for that kind of document". */
export function useSetDocumentRequest(id: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ typeId, requested }: { typeId: string; requested: boolean }) => {
      const url = `/tenant/crew/${id}/document-requests/${typeId}`;
      if (requested) await api.put(url);
      else await api.delete(url);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['crew-documents', id] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useSendCrewPasswordReset(id: string) {
  const toast = useToast();
  return useMutation({
    mutationFn: async () => {
      await api.post(`/tenant/crew/${id}/password-reset`);
    },
    onSuccess: () => toast.success('A password reset link was emailed to the member.'),
    onError: (e) => toast.error(describeError(e)),
  });
}

/** Whose branding and domains: the signed-in organization's own, or (for the superadmin) one organization chosen by id. */
export interface TenantScope {
  base: string;
  key: string;
  /** Changing the signed-in organization's own look re-themes this very portal. */
  own: boolean;
}
export const OWN_SCOPE: TenantScope = { base: '/tenant', key: 'own', own: true };
export const platformScope = (tenantId: string): TenantScope => ({
  base: `/platform/tenants/${tenantId}`,
  key: tenantId,
  own: false,
});

export function useBranding(scope: TenantScope = OWN_SCOPE) {
  return useQuery({
    queryKey: ['branding', scope.key],
    queryFn: async () =>
      (await api.get<Envelope<PublicTenant>>(`${scope.base}/branding`)).data.data,
  });
}

function useBrandingMutation<T>(scope: TenantScope, run: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branding', scope.key] });
      if (scope.own) void qc.invalidateQueries({ queryKey: ['tenant-look'] }); // the whole portal re-themes
      void qc.invalidateQueries({ queryKey: ['audit'] });
      void qc.invalidateQueries({ queryKey: ['platform', 'audit'] });
    },
  });
}

export const useSaveBranding = (scope: TenantScope = OWN_SCOPE) =>
  useBrandingMutation(scope, async (input: BrandingInput) =>
    api.patch(`${scope.base}/branding`, input),
  );

export const useUploadBrandingImage = (scope: TenantScope = OWN_SCOPE) =>
  useBrandingMutation(scope, async ({ kind, file }: { kind: BrandingImageKind; file: File }) => {
    const body = new FormData();
    body.append('file', file);
    return api.post(`${scope.base}/branding/${kind}`, body);
  });

export const useRemoveBrandingImage = (scope: TenantScope = OWN_SCOPE) =>
  useBrandingMutation(scope, async (kind: BrandingImageKind) =>
    api.delete(`${scope.base}/branding/${kind}`),
  );

/** Superadmin only: back to the Sailix look (the endpoint exists for the platform scope alone). */
export const useResetBranding = (scope: TenantScope) =>
  useBrandingMutation(scope, async () => api.post(`${scope.base}/branding/reset`));

export interface DomainList {
  default_address: string;
  slug: string;
  domains: TenantDomain[];
}

export function useDomains(scope: TenantScope = OWN_SCOPE) {
  return useQuery({
    queryKey: ['domains', scope.key],
    queryFn: async () => (await api.get<Envelope<DomainList>>(`${scope.base}/domains`)).data.data,
  });
}

export function useAddDomain(scope: TenantScope = OWN_SCOPE) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (domain: string) =>
      (await api.post<Envelope<TenantDomain>>(`${scope.base}/domains`, { domain })).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['domains', scope.key] }),
  });
}

export function useVerifyDomain(scope: TenantScope = OWN_SCOPE) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Envelope<TenantDomain>>(`${scope.base}/domains/${id}/verify`)).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['domains', scope.key] }),
  });
}

export function useRemoveDomain(scope: TenantScope = OWN_SCOPE) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${scope.base}/domains/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['domains', scope.key] }),
  });
}

export function useDeletionRequests(params: ListParams) {
  return useQuery({
    queryKey: ['deletion-requests', params],
    queryFn: async () =>
      (await api.get<Page<DeletionRequest>>('/tenant/deletion-requests', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useFeedback(params: ListParams) {
  return useQuery({
    queryKey: ['feedback', params],
    queryFn: async () => (await api.get<Page<Feedback>>('/tenant/feedback', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useAnnouncements(params: ListParams) {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: async () =>
      (await api.get<Page<Announcement>>('/tenant/announcements', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: AnnouncementInput }) =>
      id
        ? (await api.patch<Envelope<Announcement>>(`/tenant/announcements/${id}`, input)).data.data
        : (await api.post<Envelope<Announcement>>('/tenant/announcements', input)).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** The fleets in use among the crew, for choosing who an announcement is for. */
export function useCrewFleets() {
  return useQuery({
    queryKey: ['crew-fleets'],
    queryFn: async () => (await api.get<Envelope<string[]>>('/tenant/crew/fleets')).data.data,
  });
}

/** Attach (or replace) the file of an announcement. */
export async function attachAnnouncementFile(id: string, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  await api.post(`/tenant/announcements/${id}/attachment`, body);
}

export async function removeAnnouncementFile(id: string): Promise<void> {
  await api.delete(`/tenant/announcements/${id}/attachment`);
}

export async function openAnnouncementFile(id: string): Promise<void> {
  const res = await api.get<Blob>(`/tenant/announcements/${id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenant/announcements/${id}`);
    },
    onSuccess: () => {
      toast.success('Announcement deleted.');
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useTodos(params: ListParams) {
  return useQuery({
    queryKey: ['todos', params],
    queryFn: async () => (await api.get<Page<Todo>>('/tenant/todos', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useAssignTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      description: string;
      due_date: string | null;
      membership_ids: string[];
    }) => (await api.post<Envelope<Todo[]>>('/tenant/todos', input)).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { description?: string; due_date?: string | null };
    }) => (await api.patch<Envelope<Todo>>(`/tenant/todos/${id}`, patch)).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenant/todos/${id}`);
    },
    onSuccess: () => {
      toast.success('To-do deleted.');
      void qc.invalidateQueries({ queryKey: ['todos'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useDocuments(params: ListParams) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => (await api.get<Page<CrewDocument>>('/tenant/documents', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useReviewDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (
        await api.post<Envelope<CrewDocument>>(
          `/tenant/documents/${id}/${reason === undefined ? 'approve' : 'reject'}`,
          reason === undefined ? {} : { reason },
        )
      ).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** Opens a document in a new tab. The file is fetched with the admin's own session (it is never at a public address). */
export async function openDocumentFile(id: string): Promise<void> {
  const res = await api.get<Blob>(`/tenant/documents/${id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useCallItReports(params: ListParams) {
  return useQuery({
    queryKey: ['callit-reports', params],
    queryFn: async () =>
      (await api.get<Page<CallItReport>>('/tenant/callit/reports', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useReviewCallItReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Envelope<CallItReport>>(`/tenant/callit/reports/${id}/review`, {})).data.data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['callit-reports'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** Opens a report's attached file in a new tab, fetched with the administrator's own session. */
export async function openCallItFile(id: string): Promise<void> {
  const res = await api.get<Blob>(`/tenant/callit/reports/${id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type ImportKind = 'payslips' | 'loans';

/** Checks (`commit` false) or loads (`commit` true) a CSV. The same file is sent for both: nothing is kept on the server between them. */
export function useFinanceImport(kind: ImportKind) {
  return useMutation({
    mutationFn: async ({ file, commit }: { file: File; commit: boolean }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('commit', commit ? '1' : '0');
      return (
        await api.post<Envelope<FinanceImportResult>>(`/tenant/finance/imports/${kind}`, form)
      ).data.data;
    },
  });
}

export async function downloadImportTemplate(kind: ImportKind): Promise<void> {
  const res = await api.get<Blob>(`/tenant/finance/imports/${kind}/template`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['document-types'],
    queryFn: async () =>
      (await api.get<Envelope<DocumentType[]>>('/tenant/document-types')).data.data,
  });
}

export function useSaveDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string;
      input: { name?: string; short_name?: string | null; is_active?: boolean };
    }) =>
      id
        ? (await api.patch<Envelope<DocumentType>>(`/tenant/document-types/${id}`, input)).data.data
        : (await api.post<Envelope<DocumentType>>('/tenant/document-types', input)).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['document-types'] }),
  });
}

export function useDeleteDocumentType() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenant/document-types/${id}`);
    },
    onSuccess: () => {
      toast.success('Document type deleted.');
      void qc.invalidateQueries({ queryKey: ['document-types'] });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useTenantModules() {
  return useQuery({
    queryKey: ['tenant-modules'],
    queryFn: async () => (await api.get<Envelope<TenantModule[]>>('/tenant/modules')).data.data,
  });
}

export function useSetModuleEnabled() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ code, enabled }: { code: string; enabled: boolean }) =>
      (await api.put<Envelope<TenantModule>>(`/tenant/modules/${code}`, { enabled })).data.data,
    onSuccess: (_d, v) => {
      toast.success(v.enabled ? 'Module enabled.' : 'Module disabled.');
      void qc.invalidateQueries({ queryKey: ['tenant-modules'] });
      void qc.invalidateQueries({ queryKey: TENANT_SESSION });
    },
    onError: (e) => toast.error(describeError(e)),
  });
}

export function useTenantDetail() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: async () => (await api.get<Envelope<TenantDetail>>('/tenant')).data.data,
  });
}

export function useAuditLogs(params: ListParams) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: async () => (await api.get<Page<AuditEntry>>('/tenant/audit-logs', { params })).data,
    placeholderData: keepPreviousData,
  });
}

/**
 * The figures on the dashboard tiles. Each is a list request for one row that is only read for its total, and is asked only
 * when the signed-in person may see that area. `undefined` while it is on its way. The keys start with the list's own key, so
 * approving a document or answering a request refreshes them.
 */
export function useDashboardCounts(want: {
  crew: boolean;
  documents: boolean;
  announcements: boolean;
  requests: boolean;
}) {
  const total = async (url: string, params: Record<string, string> = {}) =>
    (await api.get<Page<unknown>>(url, { params: { ...params, per_page: 1 } })).data.meta.total;
  const [crew, pendingCrew, pendingDocs, announcements, requests] = useQueries({
    queries: [
      {
        queryKey: ['crew', 'count', 'all'],
        queryFn: () => total('/tenant/crew'),
        enabled: want.crew,
      },
      {
        queryKey: ['crew', 'count', 'pending'],
        queryFn: () => total('/tenant/crew', { 'filter[status]': 'pending' }),
        enabled: want.crew,
      },
      {
        queryKey: ['documents', 'count', 'pending'],
        queryFn: () => total('/tenant/documents', { status: 'pending' }),
        enabled: want.documents,
      },
      {
        queryKey: ['announcements', 'count'],
        queryFn: () => total('/tenant/announcements'),
        enabled: want.announcements,
      },
      {
        queryKey: ['deletion-requests', 'count'],
        queryFn: () => total('/tenant/deletion-requests'),
        enabled: want.requests,
      },
    ],
  });
  return {
    crew: crew.data,
    pendingCrew: pendingCrew.data,
    pendingDocs: pendingDocs.data,
    announcements: announcements.data,
    requests: requests.data,
  };
}
