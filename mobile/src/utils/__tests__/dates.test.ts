import {
  ageLabel,
  calendarDaysBetween,
  dueLabel,
  formatMonthYear,
  parseApiDate,
  toApiDate,
} from '../dates';

const NOW = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, afternoon

describe('dates', () => {
  it('parses api date formats as local time', () => {
    expect(parseApiDate('2026-03-05')?.getDate()).toBe(5);
    expect(parseApiDate('2026-03-05 14:20:10')?.getHours()).toBe(14);
    expect(parseApiDate('')).toBeNull();
    expect(parseApiDate('garbage')).toBeNull();
    expect(parseApiDate(null)).toBeNull();
  });

  it('counts calendar days regardless of time of day', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 12, 23, 59), new Date(2026, 9, 13, 0, 1))).toBe(1);
  });

  it('labels announcement age (BR-12: same day is Today, not Yesterday)', () => {
    expect(ageLabel('2026-10-13 01:00:00', NOW)).toBe('Today');
    expect(ageLabel('2026-10-12 23:00:00', NOW)).toBe('1d ago');
    expect(ageLabel('2026-10-03 09:00:00', NOW)).toBe('10d ago');
    expect(ageLabel('bad', NOW)).toBe('');
  });

  it('labels to-do due dates incl. overdue (BR-31)', () => {
    expect(dueLabel('2026-10-13', NOW)).toBe('Due today');
    expect(dueLabel('2026-10-14', NOW)).toBe('1 Day Left');
    expect(dueLabel('2026-10-20', NOW)).toBe('7 Days Left');
    expect(dueLabel('2026-10-12', NOW)).toBe('Overdue by 1 day');
    expect(dueLabel('2026-10-10', NOW)).toBe('Overdue by 3 days');
    expect(dueLabel(null, NOW)).toBe('');
  });

  it('formats month/year and falls back to the raw value', () => {
    expect(formatMonthYear('2026-03-15')).toBe('March, 2026');
    expect(formatMonthYear('not a date')).toBe('not a date');
  });

  it('serialises dates as yyyy-MM-dd', () => {
    expect(toApiDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
