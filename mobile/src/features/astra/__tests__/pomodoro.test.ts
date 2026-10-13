import {
  CYCLES,
  SECONDS,
  clock,
  initial,
  pause,
  reset,
  secondsLeft,
  start,
  tick,
  tip,
} from '../pomodoro';

const T0 = 1_000_000;
const sec = (n: number) => n * 1000;

describe('pomodoro state machine', () => {
  it('starts at 25:00 of work and counts down on the clock', () => {
    let t = start(initial(), T0);
    expect(secondsLeft(t, T0)).toBe(1500);
    t = tick(t, T0 + sec(60));
    expect(secondsLeft(t, T0 + sec(60))).toBe(1440);
    expect(t.phase).toBe('work');
  });

  it('pauses with the time left and resumes from it', () => {
    let t = start(initial(), T0);
    t = pause(t, T0 + sec(100));
    expect(t.running).toBe(false);
    expect(secondsLeft(t, T0 + sec(5000))).toBe(1400); // paused time does not count
    t = start(t, T0 + sec(5000));
    expect(secondsLeft(t, T0 + sec(5010))).toBe(1390);
  });

  it('goes work, short break, work, short break, work, short break, work, long break, then stops and resets', () => {
    let now = T0;
    let t = start(initial(), now);
    const seen: string[] = [`${t.phase}:${t.completed}`];
    for (let i = 0; i < 8; i++) {
      now += sec(SECONDS[t.phase]);
      t = tick(t, now);
      seen.push(`${t.phase}:${t.completed}`);
    }
    expect(seen).toEqual([
      'work:0',
      'short:1',
      'work:1',
      'short:2',
      'work:2',
      'short:3',
      'work:3',
      'long:4',
      'work:0',
    ]);
    expect(t.running).toBe(false); // after the long break it stops and starts fresh
    expect(secondsLeft(t, now)).toBe(1500);
  });

  it('takes the long break only after the fourth work session', () => {
    expect(CYCLES).toBe(4);
    let t = { ...start(initial(), T0), completed: 3 };
    t = tick(t, T0 + sec(1500));
    expect(t.phase).toBe('long');
    expect(secondsLeft(t, T0 + sec(1500))).toBe(900);
  });

  it('catches up after a long time away (the phone was locked) instead of freezing or drifting', () => {
    const t = tick(start(initial(), T0), T0 + sec(1500 + 300 + 100)); // work, short break, 100 s into the second work session
    expect(t.phase).toBe('work');
    expect(t.completed).toBe(1);
    expect(secondsLeft(t, T0 + sec(1500 + 300 + 100))).toBe(1400);
  });

  it('never shows 00:00 before a phase has really ended', () => {
    const t = start(initial(), T0);
    expect(secondsLeft(t, T0 + 1_499_900)).toBe(1); // 0.1 s left rounds up
    expect(secondsLeft(t, T0 + 1_500_000)).toBe(0);
  });

  it('reset goes back to a fresh round', () => {
    expect(reset()).toEqual(initial());
  });

  it('formats the clock and gives the break tips', () => {
    expect(clock(1500)).toBe('25:00');
    expect(clock(65)).toBe('01:05');
    expect(clock(0)).toBe('00:00');
    expect(tip('short', 1)).toBe('Take a walk and breathe.');
    expect(tip('short', 2)).toBe('Rest your eyes for a few minutes.');
    expect(tip('short', 3)).toBe('Stretch and loosen up your body.');
    expect(tip('long', 4)).toBe('Relax and take a long break.');
    expect(tip('work', 0)).toBeNull();
  });

  it('starting an already running timer changes nothing', () => {
    const t = start(initial(), T0);
    expect(start(t, T0 + sec(30))).toBe(t);
  });
});
