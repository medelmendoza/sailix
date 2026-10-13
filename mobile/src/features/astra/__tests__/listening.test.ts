import { finished, idle, msLeft, pauseSession, play, stopSession } from '../listening';
import { DURATIONS_MIN, SOUNDS, findSound, playTime } from '../sounds';

const T0 = 5_000_000;

describe('listening session (wall-clock, not counted plays)', () => {
  it('counts down the chosen time and finishes when it is up', () => {
    const s = play(idle(30), T0);
    expect(msLeft(s, T0 + 60_000)).toBe(29 * 60_000);
    expect(finished(s, T0 + 29 * 60_000)).toBe(false);
    expect(finished(s, T0 + 30 * 60_000)).toBe(true);
  });

  it('pausing keeps what is left and does not stretch the session', () => {
    let s = play(idle(5), T0);
    s = pauseSession(s, T0 + 120_000);
    expect(s.status).toBe('paused');
    expect(msLeft(s, T0 + 9_999_999)).toBe(180_000);
    s = play(s, T0 + 10_000_000);
    expect(msLeft(s, T0 + 10_060_000)).toBe(120_000);
  });

  it('stop goes back to the full time', () => {
    const s = stopSession(pauseSession(play(idle(60), T0), T0 + 1000));
    expect(s.status).toBe('stopped');
    expect(msLeft(s, T0)).toBe(60 * 60_000);
  });

  it('a stopped or paused session is never "finished"', () => {
    expect(finished(idle(5), T0 + 99_999_999)).toBe(false);
  });
});

describe('sounds', () => {
  it('has brown noise for focus and rain, water and insects for rest', () => {
    expect(SOUNDS.filter((s) => s.category === 'Focus').map((s) => s.title)).toEqual([
      'Brown noise',
    ]);
    expect(SOUNDS.filter((s) => s.category === 'Rest').map((s) => s.title)).toEqual([
      'Rain',
      'Water',
      'Insects',
    ]);
    expect(findSound('rain')?.title).toBe('Rain');
    expect(findSound('nope')).toBeUndefined();
  });

  it('offers one play (5 minutes) and then 30 to 240 minutes in steps of 30', () => {
    expect(DURATIONS_MIN).toEqual([5, 30, 60, 90, 120, 150, 180, 210, 240]);
  });

  it('formats play time', () => {
    expect(playTime(0)).toBe('0:00');
    expect(playTime(75)).toBe('1:15');
    expect(playTime(3725)).toBe('1:02:05');
  });
});
