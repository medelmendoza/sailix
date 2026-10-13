import { useSessionStore } from './sessionStore';

/**
 * Query keys for server data are prefixed with the organization and membership of the CURRENT session
 * (docs/07 §2), so a late response for a previous session can never populate the current cache.
 */
export function scopedKey(...parts: readonly unknown[]): readonly unknown[] {
  const credential = useSessionStore.getState().credential;
  if (!credential) throw new Error('scopedKey() needs an authenticated session');
  return [credential.tenantId, credential.membershipId, ...parts];
}
