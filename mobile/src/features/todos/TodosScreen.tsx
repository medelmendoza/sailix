import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormError,
  Segmented,
  SkeletonList,
} from '@/components';
import { spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useSetTodoDone, useTodos } from './api';
import { TodoRow } from './TodoRow';

const FILTERS = [
  { value: 'open', label: 'To do' },
  { value: 'done', label: 'Done' },
] as const;

export function TodosScreen() {
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const list = useTodos(filter);
  const setDone = useSetTodoDone();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];
  const overdue = list.data?.pages[0]?.overdue_count ?? 0;

  function toggle(id: string, done: boolean) {
    setError(null);
    setDone.mutate({ id, done }, { onError: (e) => setError(describeError(e)) });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void list.refetch().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {overdue > 0 && filter === 'open' ? (
        <AppText variant="caption" accessibilityRole="alert">
          {overdue === 1 ? '1 task is overdue.' : `${overdue} tasks are overdue.`}
        </AppText>
      ) : null}
      <FormError message={error} />
      {list.isPending ? (
        <SkeletonList />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'Nothing to do' : 'Nothing done yet'}
          description={
            filter === 'open'
              ? 'Tasks your organization assigns to you will appear here.'
              : 'Tasks you finish will appear here.'
          }
        />
      ) : (
        <>
          <Card style={styles.card}>
            {items.map((t) => (
              <TodoRow key={t.id} todo={t} onToggle={(done) => toggle(t.id, done)} />
            ))}
          </Card>
          {list.hasNextPage ? (
            <Button
              title="Load more"
              variant="secondary"
              loading={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.sm },
});
