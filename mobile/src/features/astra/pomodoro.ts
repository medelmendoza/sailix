/**
 * The Pomodoro timer as a pure state machine (spec 3.2, BR-50). It counts WALL-CLOCK time (an end time), not ticks, so it
 * stays right when the phone is locked or the app is in the background; the original counted one-second ticks and drifted.
 *
 * Work 25 min, short break 5 min, four works with a long break of 15 min after the fourth, and then it stops and resets.
 */
export type Phase = 'work' | 'short' | 'long';

export const SECONDS: Readonly<Record<Phase, number>> = {
  work: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};
export const CYCLES = 4;
const MS = 1000;

export type Timer = {
  phase: Phase;
  /** Work sessions finished so far (0 to 4). */
  completed: number;
  running: boolean;
  /** Time left in the phase while paused or idle. */
  remainingMs: number;
  /** When the phase ends, while running. */
  endsAt: number | null;
};

export const initial = (): Timer => ({
  phase: 'work',
  completed: 0,
  running: false,
  remainingMs: SECONDS.work * MS,
  endsAt: null,
});

export function start(t: Timer, now: number): Timer {
  return t.running ? t : { ...t, running: true, endsAt: now + t.remainingMs };
}

export function pause(t: Timer, now: number): Timer {
  return t.running && t.endsAt !== null
    ? { ...t, running: false, remainingMs: Math.max(0, t.endsAt - now), endsAt: null }
    : t;
}

export const reset = (): Timer => initial();

/** What follows the phase that just ended; `null` means the whole round is over. */
function next(phase: Phase, completed: number): { phase: Phase; completed: number } | null {
  if (phase === 'work') {
    const done = completed + 1;
    return { phase: done < CYCLES ? 'short' : 'long', completed: done };
  }
  if (phase === 'short') return { phase: 'work', completed };
  return null;
}

/** Moves the timer on to `now`: finished phases roll over (even several, after a long time away). */
export function tick(t: Timer, now: number): Timer {
  let state = t;
  while (state.running && state.endsAt !== null && now >= state.endsAt) {
    const following = next(state.phase, state.completed);
    if (!following) return initial(); // the long break is over: stop and start fresh
    state = {
      ...state,
      ...following,
      endsAt: state.endsAt + SECONDS[following.phase] * MS,
      remainingMs: SECONDS[following.phase] * MS,
    };
  }
  return state;
}

/** Whole seconds left, rounded up so the clock never shows 00:00 before the phase has really ended. */
export function secondsLeft(t: Timer, now: number): number {
  const ms = t.running && t.endsAt !== null ? t.endsAt - now : t.remainingMs;
  return Math.max(0, Math.ceil(ms / MS));
}

export const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const PHASE_LABEL: Readonly<Record<Phase, string>> = {
  work: 'Work',
  short: 'Short break',
  long: 'Long break',
};

/** What to do in the break that follows work session number `completed` (spec BR-50). */
export function tip(phase: Phase, completed: number): string | null {
  if (phase === 'short') {
    return (
      [
        'Take a walk and breathe.',
        'Rest your eyes for a few minutes.',
        'Stretch and loosen up your body.',
      ][completed - 1] ?? null
    );
  }
  return phase === 'long' ? 'Relax and take a long break.' : null;
}
