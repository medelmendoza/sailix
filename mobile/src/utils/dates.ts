const MS_PER_DAY = 86_400_000;

/** Parses `yyyy-MM-dd` and `yyyy-MM-dd HH:mm:ss` (and ISO) as local time; null if invalid. */
export function parseApiDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Number.isNaN(date.getTime()) ? null : date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Calendar days from `from` to `to` (positive when `to` is later). DST-safe. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** BR-12: "Today", "1d ago", "5d ago". (Flutter showed "Yesterday" for same-day items.) */
export function ageLabel(createdAt: unknown, now: Date = new Date()): string {
  const created = parseApiDate(createdAt);
  if (!created) return '';
  const days = calendarDaysBetween(created, now);
  return days <= 0 ? 'Today' : `${days}d ago`;
}

/** BR-31: due-date wording for to-dos. */
export function dueLabel(dueDate: unknown, now: Date = new Date()): string {
  const due = parseApiDate(dueDate);
  if (!due) return '';
  const days = calendarDaysBetween(now, due);
  if (days === 0) return 'Due today';
  if (days === 1) return '1 Day Left';
  if (days > 1) return `${days} Days Left`;
  return days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `MMMM, yyyy` for payslip list titles; falls back to the raw value when unparseable. */
export function formatMonthYear(value: unknown): string {
  const d = parseApiDate(value);
  if (!d) return typeof value === 'string' ? value : '';
  return `${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** `yyyy-MM-dd` for request bodies. */
export function toApiDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
