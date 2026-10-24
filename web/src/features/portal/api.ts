import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api/client';
import { toApiError } from '../../services/api/errors';
import type {
  CrewDocument,
  DocumentRequestItem,
  DocumentType,
  Envelope,
  FinanceStatus,
  ListParams,
  LoanList,
  MemberAnnouncementPage,
  MemberDocumentList,
  MemberTodoPage,
  PayslipDetail,
  PayslipSummary,
  Todo,
  Announcement,
} from '../../services/api/types';

/**
 * Everything the client portal asks of the API: the member's own records. Nothing here names an organization or a member:
 * both come from the signed-in session on the server. Keys start with `portal` so signing out (which clears the cache)
 * and writes can refresh a whole area.
 */

// ---- announcements
export function useMyAnnouncements(params: ListParams) {
  return useQuery({
    queryKey: ['portal', 'announcements', params],
    queryFn: async () => (await api.get<MemberAnnouncementPage>('/announcements', { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  return async (id: string) => {
    try {
      await api.put(`/announcements/${id}/read`);
      await qc.invalidateQueries({ queryKey: ['portal', 'announcements'] });
    } catch {
      // read state is a convenience, never a reason to interrupt reading
    }
  };
}

// ---- documents
export type DocumentView = 'approved' | 'review';

export function useMyDocuments(view: DocumentView) {
  return useQuery({
    queryKey: ['portal', 'documents', 'list', view],
    queryFn: async () =>
      (await api.get<MemberDocumentList>('/documents', { params: { status: view } })).data,
  });
}

/** What the agency asked this member to submit or renew; it shrinks by itself once they send the document in. */
export function useMyDocumentRequests() {
  return useQuery({
    queryKey: ['portal', 'documents', 'requests'],
    queryFn: async () =>
      (await api.get<Envelope<DocumentRequestItem[]>>('/document-requests')).data.data,
  });
}

export function useMyDocumentTypes() {
  return useQuery({
    queryKey: ['portal', 'documents', 'types'],
    queryFn: async () => (await api.get<Envelope<DocumentType[]>>('/document-types')).data.data,
  });
}

export interface DocumentFields {
  document_type_id: string;
  number: string;
  grade: string;
  location: string;
  school: string;
  issued_on: string;
  expires_on: string;
}

/** Submits a new document, or resubmits one that is waiting or was sent back. Empty optional fields are sent so a correction can clear them. */
export function useSaveMyDocument(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fields,
      file,
    }: {
      fields: Partial<DocumentFields>;
      file: File | null;
    }) => {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields))
        if (value !== undefined) body.append(key, value);
      if (file) body.append('file', file);
      return (
        await api.post<Envelope<CrewDocument>>(
          id ? `/documents/${id}/resubmit` : '/documents',
          body,
        )
      ).data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'documents'] }),
  });
}

/** Opens a file of the member's own (a document or an announcement's attachment) in a new tab. It is fetched with the session, never at a public address. */
export async function openMyFile(kind: 'documents' | 'announcements', id: string): Promise<void> {
  const res = await api.get<Blob>(`/${kind}/${encodeURIComponent(id)}/file`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- to-dos
export type TodoView = 'open' | 'done' | 'all';

export function useMyTodos(view: TodoView, params: ListParams = {}) {
  return useQuery({
    queryKey: ['portal', 'todos', view, params],
    queryFn: async () =>
      (
        await api.get<MemberTodoPage>('/todos', {
          params: { ...params, ...(view === 'all' ? {} : { status: view }) },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useToggleMyTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      (await api.patch<Envelope<Todo>>(`/todos/${id}`, { is_done: done })).data.data,
    onSettled: () => qc.invalidateQueries({ queryKey: ['portal', 'todos'] }),
  });
}

// ---- finance
/** The server asks for the password again (never unlocked yet, or the few minutes ran out). */
export const needsUnlock = (error: unknown) => toApiError(error).code === 'step_up_required';

export function useMyPayslips(kind: 'allotment' | 'final') {
  return useQuery({
    queryKey: ['portal', 'finance', 'payslips', kind],
    retry: false,
    queryFn: async () =>
      (await api.get<Envelope<PayslipSummary[]>>('/payslips', { params: { kind } })).data.data,
  });
}

export function useMyPayslip(id: string) {
  return useQuery({
    queryKey: ['portal', 'finance', 'payslip', id],
    retry: false,
    queryFn: async () => (await api.get<Envelope<PayslipDetail>>(`/payslips/${id}`)).data.data,
  });
}

export function useMyLoans() {
  return useQuery({
    queryKey: ['portal', 'finance', 'loans'],
    retry: false,
    queryFn: async () => (await api.get<LoanList>('/loans')).data,
  });
}

/** Sends the password for ONE call: it is never stored or logged. */
export function useUnlockFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) =>
      (await api.post<Envelope<FinanceStatus>>('/finance/unlock', { password })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'finance'] }),
  });
}

// ---- account
export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (body: {
      current_password: string;
      password: string;
      password_confirmation: string;
    }) => {
      await api.put('/me/password', body);
    },
  });
}

export function useSendFeedback() {
  return useMutation({
    mutationFn: async (body: { category: 'bug' | 'idea' | 'other'; message: string }) => {
      await api.post('/me/feedback', body);
    },
  });
}

export function useRequestDeletion() {
  return useMutation({
    mutationFn: async () => {
      await api.post('/me/deletion-request', {});
    },
  });
}

export type { Announcement };
