import { ageLabel } from '../age';

const now = new Date(2026, 9, 13, 15, 30); // 13 Oct 2026, afternoon

describe('ageLabel', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(ageLabel(new Date(2026, 9, 13, 0, 5).toISOString(), now)).toBe('Today');
    expect(ageLabel(new Date(2026, 9, 12, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(ageLabel(new Date(2026, 9, 10, 8, 0).toISOString(), now)).toBe('3 days ago');
    expect(ageLabel(new Date(2026, 8, 13, 8, 0).toISOString(), now)).toBe('30 days ago');
  });

  it('never shows a negative age for a clock that is a little off', () => {
    expect(ageLabel(new Date(2026, 9, 14, 9, 0).toISOString(), now)).toBe('Today');
  });

  it('says nothing for a date it cannot read', () => {
    expect(ageLabel('not a date', now)).toBe('');
  });
});
