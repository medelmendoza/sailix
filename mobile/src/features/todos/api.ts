import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/services/api/client';
import type { Envelope, MemberTodoPage, Todo } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';

const PER_PAGE = 20;

/** Only the signed-in member's own tasks come back: the server decides that from the session, nothing here names a member. */
export function useTodos(status?: 'open' | 'done') {
  return useInfiniteQuery({
    queryKey: scopedKey('todos', 'list', status ?? 'all'),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<MemberTodoPage>('/todos', {
          params: { page: pageParam, per_page: PER_PAGE, ...(status ? { status } : {}) },
        })
      ).data,
    getNextPageParam: (last) =>
      last.meta.current_page < (last.meta.last_page ?? 1) ? last.meta.current_page + 1 : undefined,
  });
}

/** The next few open tasks, for the Dashboard card. */
export function useNextTodos() {
  return useQuery({
    queryKey: scopedKey('todos', 'next'),
    queryFn: async () =>
      (await api.get<MemberTodoPage>('/todos', { params: { status: 'open', per_page: 3 } })).data,
  });
}

type Snapshot = [readonly unknown[], unknown][];

/** Ticks or unticks a task at once on screen, and puts it back (with a message) if the server says no. */
export function useSetTodoDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      (await api.patch<Envelope<Todo>>(`/todos/${id}`, { is_done: done })).data.data,
    onMutate: async ({ id, done }) => {
      const key = scopedKey('todos');
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot: Snapshot = queryClient.getQueriesData({ queryKey: key });
      const flip = (t: Todo): Todo => (t.id === id ? { ...t, is_done: done } : t);
      queryClient.setQueriesData<InfiniteData<MemberTodoPage> | MemberTodoPage>(
        { queryKey: key },
        (old) => {
          if (!old) return old;
          if ('pages' in old) {
            return { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map(flip) })) };
          }
          return { ...old, data: old.data.map(flip) };
        },
      );
      return { snapshot };
    },
    onError: (_e, _v, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scopedKey('todos') }),
  });
}
