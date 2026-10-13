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
  kind: 'completed' | 'flashcards';
  assignId: string;
  /** a video/PDF id, or the flashcard set id */
  materialId: string;
  /** completed videos: star rating (1 to 5, half steps) and comment, required by the Tala app */
  feedback?: { rating: number; comment: string };
  /** flashcards: the deck version the ratings were made against, and a rating for EVERY card */
  version?: string | null;
  ratings?: { index: number; rating: 'easy' | 'medium' | 'hard' }[];
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
  const items = (await read<OutboxItem[]>(key(scope, 'outbox'))) ?? [];
  return items.map((i) => ({ ...i, kind: i.kind ?? 'completed' })); // items queued by an older build were completions
}
export const setOutbox = (scope: string, items: OutboxItem[]) => write(key(scope, 'outbox'), items);

/** Study progress of one flashcard set, kept on the device until the set is complete and sent. */
export type LocalRatings = { version: string; ratings: Record<string, 'easy' | 'medium' | 'hard'> };
export const getLocalRatings = (scope: string, assignId: string, cardId: string) =>
  read<LocalRatings>(key(scope, `ratings:${assignId}:${cardId}`));
export const setLocalRatings = (scope: string, assignId: string, cardId: string, v: LocalRatings) =>
  write(key(scope, `ratings:${assignId}:${cardId}`), v);

/** The last deck seen, for offline study (cards are study material, not secrets). */
export const getCachedDeck = (scope: string, assignId: string, cardId: string) =>
  read<{ fetchedAt: string; deck: import('@/services/api/types').TalaDeck }>(
    key(scope, `deck:${assignId}:${cardId}`),
  );
export const setCachedDeck = (
  scope: string,
  assignId: string,
  cardId: string,
  v: { fetchedAt: string; deck: import('@/services/api/types').TalaDeck },
) => write(key(scope, `deck:${assignId}:${cardId}`), v);
