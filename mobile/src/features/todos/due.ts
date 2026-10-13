import { parseDay } from '@/features/modules/tala/stats';

export type TodoDue = { text: string; tone: 'overdue' | 'soon' | 'ok' | 'done' | 'none' };

const DAY_MS = 86_400_000;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * How a task's due date reads. The date is a calendar DAY (`YYYY-MM-DD`), counted in the phone's own time zone. A finished
 * task never reads as overdue, and one without a date says so.
 */
export function todoDue(
  todo: { due_date: string | null; is_done: boolean },
  today: Date = new Date(),
): TodoDue {
  if (todo.is_done) return { text: 'Done', tone: 'done' };
  const due = parseDay(todo.due_date);
  if (!due) return { text: 'No due date', tone: 'none' };
  const left = Math.round(
    (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      DAY_MS,
  );
  if (left < 0) return { text: `Overdue by ${plural(-left, 'day')}`, tone: 'overdue' };
  if (left === 0) return { text: 'Due today', tone: 'soon' };
  if (left === 1) return { text: 'Due tomorrow', tone: 'soon' };
  return { text: `${plural(left, 'day')} left`, tone: left <= 3 ? 'soon' : 'ok' };
}
