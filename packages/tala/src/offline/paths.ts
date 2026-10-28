import { Directory, Paths } from 'expo-file-system';
export { currentScope } from '../runtime';

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
