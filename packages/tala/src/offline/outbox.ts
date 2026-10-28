import NetInfo from '@react-native-community/netinfo';
import { describeError, toApiError } from '../errors';
import { getRuntime, scopedKey } from '../runtime';
import { currentScope } from './paths';
import { getOutbox, setOutbox, type OutboxItem } from './store';

/**
 * Things the user did, recorded on the device and delivered to Tala when possible (the payload is built from Tala's own stored snapshot):
 *   - 'completed'  a video/PDF finished (a video carries the star rating + comment, as the Tala app requires)
 *   - 'flashcards' the COMPLETE set of ratings of one flashcard set (Tala records a set only when every card is rated)
 * Items survive restarts; they are scoped to organization+membership and wiped on sign-out. Delivery never blocks the UI
 * and never drops an item because of a transient problem.
 */
export type Feedback = { rating: number; comment: string };

const same = (a: OutboxItem, kind: OutboxItem['kind'], assignId: string, materialId: string) =>
  a.kind === kind && a.assignId === assignId && a.materialId === materialId;

async function enqueue(
  item: Omit<OutboxItem, 'queuedAt' | 'attempts' | 'lastError'>,
): Promise<void> {
  const scope = currentScope();
  const items = await getOutbox(scope);
  const entry: OutboxItem = {
    ...item,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  const at = items.findIndex((i) => same(i, item.kind, item.assignId, item.materialId));
  if (at >= 0)
    items[at] = entry; // idempotent: the newest content for the same thing replaces the older
  else items.push(entry);
  await setOutbox(scope, items);
}

export const queueCompletion = (assignId: string, materialId: string, feedback?: Feedback) =>
  enqueue({ kind: 'completed', assignId, materialId, ...(feedback ? { feedback } : {}) });

export const queueFlashcards = (
  assignId: string,
  cardId: string,
  version: string | null,
  ratings: { index: number; rating: 'easy' | 'medium' | 'hard' }[],
) => enqueue({ kind: 'flashcards', assignId, materialId: cardId, version, ratings });

export async function pendingCompletions(): Promise<OutboxItem[]> {
  return getOutbox(currentScope());
}

export type SyncResult = {
  sent: number;
  kept: number;
  dropped: number;
  stopped: 'offline' | 'relink' | 'disabled' | null;
};

let running: Promise<SyncResult> | null = null;

/** One delivery run at a time. Safe to call from anywhere (foreground, reconnect, button). */
export function syncOutbox(): Promise<SyncResult> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

type Attempt = { items: OutboxItem[]; send: () => Promise<unknown> };

function attemptsFor(items: OutboxItem[]): Attempt[] {
  const attempts: Attempt[] = [];
  const byCourse = new Map<string, OutboxItem[]>();
  for (const i of items) byCourse.set(i.assignId, [...(byCourse.get(i.assignId) ?? []), i]);
  for (const [assignId, group] of byCourse) {
    const done = group.filter((g) => g.kind === 'completed');
    if (done.length > 0) {
      const feedback = Object.fromEntries(
        done.filter((d) => d.feedback).map((d) => [d.materialId, d.feedback]),
      );
      attempts.push({
        items: done,
        send: () =>
          getRuntime().source.submitProgress(
            assignId,
            done.map((d) => d.materialId),
            feedback as Record<string, Feedback>,
          ),
      });
    }
    for (const deck of group.filter((g) => g.kind === 'flashcards')) {
      attempts.push({
        items: [deck],
        send: () =>
          getRuntime().source.submitRatings(
            assignId,
            deck.materialId,
            deck.version ?? null,
            deck.ratings ?? [],
          ),
      });
    }
  }
  return attempts;
}

async function run(): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, kept: 0, dropped: 0, stopped: null };
  const scope = currentScope();
  let items = await getOutbox(scope);
  if (items.length === 0) return result;
  if (!(await NetInfo.fetch()).isConnected)
    return { ...result, kept: items.length, stopped: 'offline' };

  for (const attempt of attemptsFor(items)) {
    if (currentScope() !== scope) break; // the session changed while we were sending: never touch another scope
    const group = attempt.items;
    try {
      await attempt.send();
      items = items.filter((i) => !group.includes(i));
      result.sent += group.length;
      await getRuntime().queryClient.invalidateQueries({ queryKey: scopedKey('tala') });
    } catch (e) {
      const err = toApiError(e);
      const message = describeError(e);
      if (err.kind === 'network' || (err.status !== undefined && err.status >= 500)) {
        group.forEach((g) => ((g.attempts += 1), (g.lastError = message)));
        result.stopped = 'offline';
        break; // the same would happen for the next one: try again later
      }
      if (err.code === 'relink_required' || err.code === 'not_linked') {
        group.forEach((g) => (g.lastError = message));
        result.stopped = 'relink';
        break;
      }
      if (err.code === 'feature_disabled') {
        group.forEach((g) => (g.lastError = message));
        result.stopped = 'disabled';
        break;
      }
      if (err.code === 'progress_busy' || err.status === 429) {
        group.forEach((g) => ((g.attempts += 1), (g.lastError = message)));
        continue; // try this one on the next run
      }
      // 404 / 422 / 409 deck_changed: this item can never be accepted as it is: drop it, do not loop forever
      items = items.filter((i) => !group.includes(i));
      result.dropped += group.length;
    }
  }

  if (currentScope() === scope) await setOutbox(scope, items);
  result.kept = items.length;
  return result;
}
