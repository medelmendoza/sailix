import type { QueryClient } from '@tanstack/react-query';
import type { TalaHost } from './host';
import type { TalaSession } from './direct/auth';
import type { TalaClient } from './direct/client';
import type { TalaDataSource } from './data/source';

/**
 * What the screens' plain (non-hook) functions need: the data source, the query cache and the scope of the signed-in
 * Tala user. `<TalaRoot>` sets it before anything renders. shortcut: one Tala is mounted at a time per app, so this is a
 * module-level value rather than context; give each mount its own if two ever run side by side.
 */
export interface TalaRuntime {
  host: TalaHost;
  session: TalaSession;
  client: TalaClient;
  source: TalaDataSource;
  queryClient: QueryClient;
  /** Set once a Tala user and team are chosen: namespaces query keys and everything stored on the device. */
  scope: string | null;
}

let current: TalaRuntime | null = null;

export const setRuntime = (r: TalaRuntime | null) => {
  current = r;
};

export function getRuntime(): TalaRuntime {
  if (!current) throw new Error('Tala is not started: render <TalaRoot>.');
  return current;
}

/** Folder- and key-safe scope of a host scope + Tala user + team. */
export const makeScope = (hostScope: string, userId: string, teamId: string) =>
  [hostScope || 'tala', userId, teamId].join('_').replace(/[^A-Za-z0-9_-]/g, '-');

export function currentScope(): string {
  const scope = getRuntime().scope;
  if (!scope) throw new Error('Tala storage needs a signed-in user and team.');
  return scope;
}

/** Query keys are prefixed with the scope, so a late answer for another user or team can never fill the current cache. */
export function scopedKey(...parts: readonly unknown[]): readonly unknown[] {
  return [currentScope(), ...parts];
}

/** Records the scope of the signed-in Tala user and team (null when nobody is). */
export const setScope = (r: TalaRuntime, scope: string | null) => {
  r.scope = scope;
};
