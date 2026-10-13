import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { toApiError } from '@/services/api/errors';
import type { Envelope, TalaCourse, TalaCourseDetail, TalaMaterial } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';
import { useSessionStore } from '@/store/sessionStore';

/**
 * Tala data goes ONLY through the Sailix gateway (/modules/tala/*): the server knows which Tala account and team
 * belong to this membership. Nothing here sends a Tala user id, team id, token or role. Query keys are scoped to the
 * current organization + membership (cleared on sign-out and organization switch).
 */
const base = '/modules/tala';

/** The gateway says the stored Tala token is no longer accepted: refresh `/me` so the screen shows the link form. */
function noteRelink(error: unknown) {
  const e = toApiError(error);
  if (e.code === 'relink_required' || e.code === 'not_linked') {
    void useSessionStore
      .getState()
      .refreshMe()
      .catch(() => undefined);
  }
}

export function useTalaCourses() {
  return useQuery({
    queryKey: scopedKey('tala', 'courses'),
    queryFn: async () => {
      try {
        return (await api.get<Envelope<TalaCourse[]>>(`${base}/courses`)).data.data;
      } catch (e) {
        noteRelink(e);
        throw e;
      }
    },
  });
}

export function useTalaCourse(assignId: string) {
  return useQuery({
    queryKey: scopedKey('tala', 'course', assignId),
    queryFn: async () => {
      try {
        return (
          await api.get<Envelope<TalaCourseDetail>>(
            `${base}/courses/${encodeURIComponent(assignId)}`,
          )
        ).data.data;
      } catch (e) {
        noteRelink(e);
        throw e;
      }
    },
  });
}

export async function fetchTalaMaterial(
  assignId: string,
  materialId: string,
): Promise<TalaMaterial> {
  return (
    await api.get<Envelope<TalaMaterial>>(
      `${base}/courses/${encodeURIComponent(assignId)}/materials/${encodeURIComponent(materialId)}`,
    )
  ).data.data;
}

/** Credentials are passed straight through to the server for ONE call and kept nowhere (no store, no cache). */
export function useLinkTala() {
  const queryClient = useQueryClient();
  const refreshMe = useSessionStore((s) => s.refreshMe);
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      api.post(`${base}/link`, { username: credentials.username, password: credentials.password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scopedKey('tala') });
      await refreshMe();
    },
  });
}

export function useUnlinkTala() {
  const queryClient = useQueryClient();
  const refreshMe = useSessionStore((s) => s.refreshMe);
  return useMutation({
    mutationFn: () => api.delete(`${base}/link`),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: scopedKey('tala') });
      await refreshMe();
    },
  });
}
