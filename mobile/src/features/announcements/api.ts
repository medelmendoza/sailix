import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import type { Announcement, Envelope, MemberAnnouncementPage } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';

const PER_PAGE = 20;

/** The organization comes from the session on the server: nothing here names an organization or a member. */
export function useAnnouncements() {
  return useInfiniteQuery({
    queryKey: scopedKey('announcements', 'list'),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<MemberAnnouncementPage>('/announcements', {
          params: { page: pageParam, per_page: PER_PAGE },
        })
      ).data,
    getNextPageParam: (last) =>
      last.meta.current_page < (last.meta.last_page ?? 1) ? last.meta.current_page + 1 : undefined,
  });
}

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: scopedKey('announcements', 'unread'),
    enabled,
    queryFn: async () =>
      (await api.get<MemberAnnouncementPage>('/announcements', { params: { per_page: 1 } })).data
        .unread_count,
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: scopedKey('announcements', 'one', id),
    queryFn: async () => (await api.get<Envelope<Announcement>>(`/announcements/${id}`)).data.data,
  });
}

/** Marks one read (idempotent) and refreshes the list and the unread badge. A failure is silent: it retries on the next open. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return async (id: string) => {
    try {
      await api.put(`/announcements/${id}/read`);
      await queryClient.invalidateQueries({ queryKey: scopedKey('announcements') });
    } catch {
      // read state is a convenience, never a reason to interrupt reading
    }
  };
}
