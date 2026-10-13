import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card } from '@/components';
import { spacing } from '@/constants/theme';
import { useNextTodos, useSetTodoDone } from './api';
import { TodoRow } from './TodoRow';

/** Dashboard card: the next few open tasks. Never in the way: it renders nothing while loading, on error, or when nothing is open. */
export function HomeTodos() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const next = useNextTodos();
  const setDone = useSetTodoDone();
  const items = next.data?.data ?? [];
  const open = next.data?.open_count ?? 0;
  if (items.length === 0) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        {open > 1 ? `To-do (${open})` : 'To-do'}
      </AppText>
      {items.map((t) => (
        <TodoRow key={t.id} todo={t} onToggle={(done) => setDone.mutate({ id: t.id, done })} />
      ))}
      <Button
        title="See all to-dos"
        variant="secondary"
        onPress={() => navigation.navigate('Todos')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
