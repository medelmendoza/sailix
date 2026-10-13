import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TalaCourse, TalaCourseDetail } from '@/services/api/types';
import { KEY_PREFIX } from './wipe';

/** Small JSON records, scoped per organization+membership. No tokens, no passwords, no personal profile data. */
export type CachedCourses = { fetchedAt: string; courses: TalaCourse[] };
export type CachedCourse = { fetchedAt: string; course: TalaCourseDetail };
export type DownloadRecord = {
  materialId: string;
  assignId: string;
  type: 'video' | 'pdf';
  name: string;
  uri: string;
  bytes: number;
  downloadedAt: string;
};
export type OutboxItem = {
  assignId: string;
  materialId: string;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
};

const key = (scope: string, name: string) => `${KEY_PREFIX}${scope}:${name}`;

async function read<T>(k: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // unreadable or corrupt: behave as empty
  }
}
const write = (k: string, v: unknown) => AsyncStorage.setItem(k, JSON.stringify(v));

export const getCachedCourses = (scope: string) => read<CachedCourses>(key(scope, 'courses'));
export const setCachedCourses = (scope: string, v: CachedCourses) =>
  write(key(scope, 'courses'), v);
export const getCachedCourse = (scope: string, assignId: string) =>
  read<CachedCourse>(key(scope, `course:${assignId}`));
export const setCachedCourse = (scope: string, assignId: string, v: CachedCourse) =>
  write(key(scope, `course:${assignId}`), v);

export async function getDownloads(scope: string): Promise<Record<string, DownloadRecord>> {
  return (await read<Record<string, DownloadRecord>>(key(scope, 'downloads'))) ?? {};
}
export async function putDownload(scope: string, record: DownloadRecord): Promise<void> {
  const all = await getDownloads(scope);
  all[record.materialId] = record;
  await write(key(scope, 'downloads'), all);
}
export async function removeDownloadRecord(scope: string, materialId: string): Promise<void> {
  const all = await getDownloads(scope);
  delete all[materialId];
  await write(key(scope, 'downloads'), all);
}

export async function getOutbox(scope: string): Promise<OutboxItem[]> {
  return (await read<OutboxItem[]>(key(scope, 'outbox'))) ?? [];
}
export const setOutbox = (scope: string, items: OutboxItem[]) => write(key(scope, 'outbox'), items);
