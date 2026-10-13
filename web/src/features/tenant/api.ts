import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui';
import { api } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import type {
  AuditEntry,
  DeletionRequest,
  Envelope,
  ListParams,
  Membership,
  Page,
  TenantDetail,
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
