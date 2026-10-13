import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui';
import { api } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import type {
  Announcement,
  AnnouncementInput,
  AuditEntry,
  CrewDocument,
  DocumentType,
  DeletionRequest,
  Envelope,
  Feedback,
  ListParams,
  Membership,
  Page,
  TenantDetail,
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
      void qc.invalidateQueries({ queryKey: ['member-count'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(describeError(e)),
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
