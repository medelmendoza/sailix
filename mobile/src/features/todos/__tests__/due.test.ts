import { todoDue } from '../due';

const today = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, afternoon

describe('todoDue', () => {
  it('counts calendar days in the phone time zone', () => {
    expect(todoDue({ due_date: '2026-10-11', is_done: false }, today)).toEqual({
      text: 'Overdue by 2 days',
      tone: 'overdue',
    });
    expect(todoDue({ due_date: '2026-10-12', is_done: false }, today).text).toBe(
      'Overdue by 1 day',
    );
    expect(todoDue({ due_date: '2026-10-13', is_done: false }, today)).toEqual({
      text: 'Due today',
      tone: 'soon',
    });
    expect(todoDue({ due_date: '2026-10-14', is_done: false }, today)).toEqual({
      text: 'Due tomorrow',
      tone: 'soon',
    });
    expect(todoDue({ due_date: '2026-10-16', is_done: false }, today)).toEqual({
      text: '3 days left',
      tone: 'soon',
    });
    expect(todoDue({ due_date: '2026-10-30', is_done: false }, today)).toEqual({
      text: '17 days left',
      tone: 'ok',
    });
  });

  it('never calls a finished task overdue', () => {
    expect(todoDue({ due_date: '2020-01-01', is_done: true }, today)).toEqual({
      text: 'Done',
      tone: 'done',
    });
  });

  it('says so when there is no date, or the date is not a real day', () => {
    expect(todoDue({ due_date: null, is_done: false }, today)).toEqual({
      text: 'No due date',
      tone: 'none',
    });
    expect(todoDue({ due_date: '2026-02-30', is_done: false }, today).text).toBe('No due date');
  });
});
