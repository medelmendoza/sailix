import { statusWord } from '../TalaCourseScreen';

describe('statusWord', () => {
  it('turns Tala’s shouted completion status into a plain word', () => {
    expect(statusWord('COMPLETED')).toBe('Completed');
    expect(statusWord('completed')).toBe('Completed');
  });

  it('says nothing for statuses that carry no meaning for a learner', () => {
    for (const s of ['DEFAULT', 'NOT STARTED', 'NOT YET COMPLETED', 'INACTIVE', '', null]) {
      expect(statusWord(s as string | null)).toBeNull();
    }
  });

  it('shows any other status as Tala gave it rather than hiding it', () => {
    expect(statusWord('ongoing')).toBe('ongoing');
  });
});
