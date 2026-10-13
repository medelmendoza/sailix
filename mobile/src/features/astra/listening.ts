/**
 * A listening session: the 5-minute clip repeats until the chosen time is up. Measured on the CLOCK (an end time), so
 * pausing never stretches the session and a late timer beat never changes it (the original counted finished plays).
 */
export type Session = {
  status: 'stopped' | 'playing' | 'paused';
  totalMs: number;
  remainingMs: number;
  endsAt: number | null;
};

export const idle = (minutes: number): Session => ({
  status: 'stopped',
  totalMs: minutes * 60_000,
  remainingMs: minutes * 60_000,
  endsAt: null,
});

export const play = (s: Session, now: number): Session =>
  s.status === 'playing' ? s : { ...s, status: 'playing', endsAt: now + s.remainingMs };

export const pauseSession = (s: Session, now: number): Session =>
  s.status === 'playing' && s.endsAt !== null
    ? { ...s, status: 'paused', remainingMs: Math.max(0, s.endsAt - now), endsAt: null }
    : s;

export const stopSession = (s: Session): Session => idle(s.totalMs / 60_000);

/** True when the chosen time has run out. */
export const finished = (s: Session, now: number) =>
  s.status === 'playing' && s.endsAt !== null && now >= s.endsAt;

export function msLeft(s: Session, now: number): number {
  return s.status === 'playing' && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;
}
