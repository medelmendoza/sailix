import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { toApiError } from '@/services/api/errors';
import type {
  Envelope,
  FinanceStatus,
  LoanList,
  PayslipDetail,
  PayslipSummary,
} from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';

export type PayslipKind = 'allotment' | 'final';

/** The server asks for the password again (never unlocked yet, or the few minutes ran out). */
export const needsUnlock = (error: unknown) => toApiError(error).code === 'step_up_required';

export function usePayslips(kind: PayslipKind) {
  return useQuery({
    queryKey: scopedKey('finance', 'payslips', kind),
    retry: false,
    queryFn: async () =>
      (await api.get<Envelope<PayslipSummary[]>>('/payslips', { params: { kind } })).data.data,
  });
}

export function usePayslip(id: string) {
  return useQuery({
    queryKey: scopedKey('finance', 'payslip', id),
    retry: false,
    queryFn: async () => (await api.get<Envelope<PayslipDetail>>(`/payslips/${id}`)).data.data,
  });
}

export function useLoans() {
  return useQuery({
    queryKey: scopedKey('finance', 'loans'),
    queryFn: async () => (await api.get<LoanList>('/loans')).data,
  });
}

/** Sends the password to the server for ONE call: it is never stored, logged or kept in state beyond the field. */
export function useUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) =>
      (await api.post<Envelope<FinanceStatus>>('/finance/unlock', { password })).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopedKey('finance') }),
  });
}
