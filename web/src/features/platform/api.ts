import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui';
import { api } from '../../services/api/client';
import { describeError } from '../../services/api/errors';
import type {
  AuditEntry,
  Envelope,
  ListParams,
  Membership,
  Page,
  PlatformTenantFeature,
  PlatformTenantModule,
  Tenant,
} from '../../services/api/types';

export function useTenants(params: ListParams) {
  return useQuery({
    queryKey: ['platform', 'tenants', params],
    queryFn: async () => (await api.get<Page<Tenant>>('/platform/tenants', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useTenantStatusCount(status: string) {
  return useQuery({
    queryKey: ['platform', 'tenant-count', status],
    queryFn: async () =>
      (
        await api.get<Page<Tenant>>('/platform/tenants', {
          params: { 'filter[status]': status, per_page: 1 },
        })
      ).data.meta.total,
  });
}

export function useTenantById(id: string) {
  return useQuery({
    queryKey: ['platform', 'tenant', id],
    queryFn: async () => (await api.get<Envelope<Tenant>>(`/platform/tenants/${id}`)).data.data,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { code: string; name: string; slug?: string }) =>
      (await api.post<Envelope<Tenant>>('/platform/tenants', body)).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason?: string }) =>
      (
        await api.post<Envelope<Tenant>>(`/platform/tenants/${id}/${action}`, {
          reason: reason || null,
        })
      ).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useTenantAdmins(id: string) {
  return useQuery({
    queryKey: ['platform', 'tenant', id, 'admins'],
    queryFn: async () => (await api.get<Page<Membership>>(`/platform/tenants/${id}/admins`)).data,
  });
}

export function useInviteAdmin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; username?: string; display_name?: string }) =>
      (await api.post<Envelope<Membership>>(`/platform/tenants/${id}/admins`, body)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform', 'tenant', id, 'admins'] }),
  });
}

export function usePlatformModules(id: string) {
  return useQuery({
    queryKey: ['platform', 'tenant', id, 'modules'],
    queryFn: async () =>
      (await api.get<Envelope<PlatformTenantModule[]>>(`/platform/tenants/${id}/modules`)).data
        .data,
  });
}

export function useProvisionModule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      ...body
    }: {
      code: string;
      external_team_id?: string;
      enabled: boolean;
    }) =>
      (
        await api.put<Envelope<PlatformTenantModule>>(
          `/platform/tenants/${id}/modules/${code}`,
          body,
        )
      ).data.data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform', 'tenant', id, 'modules'] }),
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: async () =>
      (await api.get<Envelope<Record<string, unknown>>>('/platform/settings')).data.data,
  });
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) =>
      (await api.patch<Envelope<Record<string, unknown>>>('/platform/settings', { settings })).data
        .data,
    onSuccess: () => {
      toast.success('Platform settings saved.');
      void qc.invalidateQueries({ queryKey: ['platform', 'settings'] });
    },
    onError: () => undefined, // the form shows field-level problems itself
  });
}

export function usePlatformAudit(params: ListParams) {
  return useQuery({
    queryKey: ['platform', 'audit', params],
    queryFn: async () => (await api.get<Page<AuditEntry>>('/platform/audit-logs', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export { describeError };

export function usePlatformFeatures(id: string) {
  return useQuery({
    queryKey: ['platform', 'tenant', id, 'features'],
    queryFn: async () =>
      (await api.get<Envelope<PlatformTenantFeature[]>>(`/platform/tenants/${id}/features`)).data
        .data,
  });
}

export function useUpdateFeatures(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (features: Record<string, boolean>) =>
      (
        await api.patch<Envelope<PlatformTenantFeature[]>>(`/platform/tenants/${id}/features`, {
          features,
        })
      ).data.data,
    onSuccess: (data) => qc.setQueryData(['platform', 'tenant', id, 'features'], data),
  });
}
