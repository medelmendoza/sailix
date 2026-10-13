import type { TalaCourse } from '@/services/api/types';
import { byUrgency, dueInfo, overall, parseDay, upcoming } from '../stats';

const course = (over: Partial<TalaCourse> = {}): TalaCourse => ({
  id: 'A',
  name: 'Course A',
  description: null,
  thumbnail_url: null,
  creator: 'Capt. Reyes',
  date_from: '2026-01-01',
  date_to: '2026-10-20',
  status: 'NOT YET COMPLETED',
  progress: '1/4',
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
  total_materials: 3,
  ...over,
});
const today = new Date(2026, 9, 13); // 13 Oct 2026, local

describe('parseDay', () => {
  it('reads YYYY-MM-DD as a local calendar day and refuses anything else', () => {
    expect(parseDay('2026-10-13')?.getDate()).toBe(13);
    for (const bad of [
      null,
      '',
      '2026-02-30',
      '13/10/2026',
      '2026-10-13T00:00:00Z',
      'tomorrow',
      '2026-13-01',
    ]) {
      expect(parseDay(bad as string | null)).toBeNull();
    }
  });
});

describe('dueInfo', () => {
  it.each([
    ['2026-10-12', 'Overdue by 1 day', 'overdue'],
    ['2026-10-01', 'Overdue by 12 days', 'overdue'],
    ['2026-10-13', 'Due today', 'soon'],
    ['2026-10-14', 'Due tomorrow', 'soon'],
    ['2026-10-18', '5 days left', 'soon'],
    ['2026-10-20', '7 days left', 'soon'],
    ['2026-10-21', '8 days left', 'ok'],
    ['2026-12-31', '79 days left', 'ok'],
  ])('%s → %s', (date_to, text, tone) => {
    expect(dueInfo(course({ date_to }), today)).toEqual({ text, tone });
  });

  it('never shows a negative number of days: overdue is said as overdue', () => {
    expect(dueInfo(course({ date_to: '2026-09-01' }), today)?.text).not.toMatch(/-/);
  });

  it('a completed course says completed, even when its date has passed', () => {
    expect(dueInfo(course({ state: 'completed', date_to: '2020-01-01' }), today)).toEqual({
      text: 'Completed',
      tone: 'done',
    });
  });

  it('a course that has not started yet says when it starts', () => {
    expect(
      dueInfo(
        course({ state: 'not_started', date_from: '2026-11-01', date_to: '2026-12-01' }),
        today,
      ),
    ).toEqual({ text: 'Starts 2026-11-01', tone: 'upcoming' });
    expect(dueInfo(course({ date_from: '2026-10-13' }), today)?.tone).not.toBe('upcoming'); // starts today: it has started
  });

  it('says nothing when there is no usable date', () => {
    expect(dueInfo(course({ date_to: null }), today)).toBeNull();
    expect(dueInfo(course({ date_to: 'garbage' }), today)).toBeNull();
  });

  it('counts calendar days across a daylight-saving change (a day is not 24 hours)', () => {
    // European DST ends on 25 Oct 2026, the US one on 1 Nov 2026: both stay whole days
    expect(
      dueInfo(course({ date_to: '2026-10-27', date_from: null }), new Date(2026, 9, 24))?.text,
    ).toBe('3 days left');
    expect(
      dueInfo(course({ date_to: '2026-11-03', date_from: null }), new Date(2026, 10, 1))?.text,
    ).toBe('2 days left');
    expect(
      dueInfo(course({ date_to: '2026-03-30', date_from: null }), new Date(2026, 2, 28))?.text,
    ).toBe('2 days left');
  });
});

describe('overall', () => {
  it('adds up Tala’s own counters and counts the states', () => {
    const o = overall([
      course({ id: '1', completed: 4, total: 4, state: 'completed' }),
      course({ id: '2', completed: 1, total: 4, state: 'in_progress' }),
      course({ id: '3', completed: 0, total: 6, state: 'not_started' }),
    ]);
    expect(o).toEqual({
      courses: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
      itemsDone: 5,
      itemsTotal: 14,
      percent: 36,
    });
  });

  it('is zero for no courses, and clamps a counter above its total', () => {
    expect(overall([]).percent).toBe(0);
    expect(overall([course({ completed: 9, total: 4 })])).toMatchObject({
      itemsDone: 4,
      itemsTotal: 4,
      percent: 100,
    });
  });
});

describe('ordering', () => {
  const list = [
    course({ id: 'done', name: 'Done', state: 'completed', date_to: '2026-01-01' }),
    course({ id: 'none', name: 'No date', date_to: null }),
    course({ id: 'late', name: 'Late', date_to: '2026-10-01' }),
    course({ id: 'soon', name: 'Soon', date_to: '2026-10-15' }),
    course({ id: 'far', name: 'Far', date_to: '2026-12-01' }),
  ];

  it('puts the most urgent first, undated next, finished last', () => {
    expect(byUrgency(list).map((c) => c.id)).toEqual(['late', 'soon', 'far', 'none', 'done']);
  });

  it('lists only unfinished, dated courses under due dates, limited', () => {
    expect(upcoming(list, 2).map((c) => c.id)).toEqual(['late', 'soon']);
    expect(upcoming(list).map((c) => c.id)).toEqual(['late', 'soon', 'far']);
  });

  it('does not change the list it is given', () => {
    const copy = [...list];
    byUrgency(list);
    expect(list).toEqual(copy);
  });
});
