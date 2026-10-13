import type { TalaCourse } from '@/services/api/types';

/** How a due date should be shown. The date itself is `YYYY-MM-DD` (what Tala's course list returns). */
export type Due = { text: string; tone: 'done' | 'overdue' | 'soon' | 'ok' | 'upcoming' };

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` as a LOCAL calendar date (no time zone drift: a due date is a day, not an instant). */
export function parseDay(day: string | null): Date | null {
  const m = day ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(day) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null; // rejects 2026-02-30
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Due-date wording for a course. Fixes what the Tala app gets wrong (it shows negative "days left" for expired courses):
 * overdue is said as overdue, a course that has not started yet says when it starts, and a completed course just says so.
 */
export function dueInfo(
  course: Pick<TalaCourse, 'date_from' | 'date_to' | 'state'>,
  today: Date = new Date(),
): Due | null {
  if (course.state === 'completed') return { text: 'Completed', tone: 'done' };
  const from = parseDay(course.date_from);
  if (from && daysBetween(today, from) > 0) {
    return { text: `Starts ${course.date_from}`, tone: 'upcoming' };
  }
  const to = parseDay(course.date_to);
  if (!to) return null;
  const left = daysBetween(today, to);
  if (left < 0) return { text: `Overdue by ${plural(-left, 'day')}`, tone: 'overdue' };
  if (left === 0) return { text: 'Due today', tone: 'soon' };
  if (left === 1) return { text: 'Due tomorrow', tone: 'soon' };
  return { text: `${plural(left, 'day')} left`, tone: left <= 7 ? 'soon' : 'ok' };
}

export type Overall = {
  courses: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  itemsDone: number;
  itemsTotal: number;
  percent: number;
};

/** Totals across courses, using Tala's own per-course counters (they count every kind of item). */
export function overall(courses: readonly TalaCourse[]): Overall {
  const o: Overall = {
    courses: courses.length,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    itemsDone: 0,
    itemsTotal: 0,
    percent: 0,
  };
  for (const c of courses) {
    if (c.state === 'completed') o.completed++;
    else if (c.state === 'in_progress') o.inProgress++;
    else o.notStarted++;
    o.itemsDone += Math.min(c.completed, c.total);
    o.itemsTotal += c.total;
  }
  o.percent = o.itemsTotal > 0 ? Math.round((o.itemsDone / o.itemsTotal) * 100) : 0;
  return o;
}

/** Unfinished courses first, soonest due date first (overdue ones lead); courses without a date, then finished ones, last. */
export function byUrgency(courses: readonly TalaCourse[]): TalaCourse[] {
  const rank = (c: TalaCourse) => (c.state === 'completed' ? 2 : c.date_to ? 0 : 1);
  return [...courses].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.date_to ?? '').localeCompare(b.date_to ?? '') ||
      a.name.localeCompare(b.name),
  );
}

/** Courses worth showing under "due dates": unfinished, with a date, already started or starting soon. */
export function upcoming(courses: readonly TalaCourse[], limit = 3): TalaCourse[] {
  return byUrgency(courses)
    .filter((c) => c.state !== 'completed' && c.date_to !== null)
    .slice(0, limit);
}
