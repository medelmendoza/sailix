import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import type {
  CallItReport,
  CallItReportInput,
  CallItReportList,
  CallItStats,
  Envelope,
} from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';
import type { PickedFile } from '@/features/files/api';

export function useCallItStats() {
  return useQuery({
    queryKey: scopedKey('callit', 'stats'),
    queryFn: async () => (await api.get<Envelope<CallItStats>>('/callit/stats')).data.data,
  });
}

export function useCallItReports() {
  return useQuery({
    queryKey: scopedKey('callit', 'reports'),
    queryFn: async () =>
      (await api.get<CallItReportList>('/callit/reports', { params: { per_page: 100 } })).data,
  });
}

export function useCallItReport(id: string) {
  return useQuery({
    queryKey: scopedKey('callit', 'report', id),
    enabled: id !== '',
    queryFn: async () => (await api.get<Envelope<CallItReport>>(`/callit/reports/${id}`)).data.data,
  });
}

const multipart = {
  headers: { 'Content-Type': 'multipart/form-data' },
  transformRequest: (d: unknown) => d,
};

/**
 * Saves a draft, attaches the picked file, and (when `submit`) sends it. The file goes up BEFORE the send because a sent
 * report can no longer change. The reporter and organization always come from the session, never from this call.
 */
export function useSaveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fields,
      file,
      submit,
    }: {
      id?: string;
      fields: CallItReportInput;
      file: PickedFile | null;
      submit: boolean;
    }): Promise<CallItReport> => {
      // 1. the fields as a draft (a draft may be half written)
      const saved = id
        ? (await api.patch<Envelope<CallItReport>>(`/callit/reports/${id}`, fields)).data.data
        : (await api.post<Envelope<CallItReport>>('/callit/reports', fields)).data.data;
      // 2. the file, if a new one was picked
      if (file) {
        const form = new FormData();
        form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as never);
        await api.post(`/callit/reports/${saved.id}/file`, form, multipart);
      }
      // 3. send it (the server checks it is complete)
      return submit
        ? (await api.patch<Envelope<CallItReport>>(`/callit/reports/${saved.id}`, { submit: true }))
            .data.data
        : saved;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scopedKey('callit') }),
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/callit/reports/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopedKey('callit') }),
  });
}
