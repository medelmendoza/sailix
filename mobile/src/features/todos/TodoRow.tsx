import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import type { Todo } from '@/services/api/types';
import { todoDue } from './due';

const TONE = {
  overdue: colors.danger,
  soon: colors.warning,
  ok: colors.textMuted,
  done: colors.success,
  none: colors.textMuted,
} as const;

/** One task: a checkbox you can tick, the text (struck through when done) and when it is due. */
export function TodoRow({ todo, onToggle }: { todo: Todo; onToggle: (done: boolean) => void }) {
  const due = todoDue(todo);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: todo.is_done }}
      accessibilityLabel={`${todo.description}, ${due.text}`}
      onPress={() => onToggle(!todo.is_done)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.box, todo.is_done && styles.boxDone]}>
        {todo.is_done ? <View style={styles.tick} /> : null}
      </View>
      <View style={styles.text}>
        <AppText style={todo.is_done ? styles.struck : undefined}>{todo.description}</AppText>
        <AppText variant="caption" style={{ color: TONE[due.tone] }}>
          {due.text}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouchTarget },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxDone: { backgroundColor: colors.success, borderColor: colors.success },
  // a tick drawn from two borders, no icon font
  tick: {
    width: 6,
    height: 12,
    marginTop: -2,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.onPrimary,
    transform: [{ rotate: '45deg' }],
  },
  text: { flex: 1, gap: 2 },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
});
