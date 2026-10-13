import { Directory, Paths } from 'expo-file-system';
import { useSessionStore } from '@/store/sessionStore';

/** Everything stored on the device for Tala is namespaced by organization + membership, like the query cache. */
export function currentScope(): string {
  const c = useSessionStore.getState().credential;
  if (!c) throw new Error('offline storage needs an authenticated session');
  return `${c.tenantId}_${c.membershipId}`;
}

export const ROOT_DIR_NAME = 'tala';

export function rootDir(): Directory {
  return new Directory(Paths.document, ROOT_DIR_NAME);
}

export function scopeDir(scope: string): Directory {
  return new Directory(Paths.document, ROOT_DIR_NAME, scope);
}

/** A material id is validated by the gateway; this is a second, local guard before it becomes a path segment. */
export function assertSafeSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('unsafe path segment');
  return value;
}
