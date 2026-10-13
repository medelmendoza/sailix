import NetInfo from '@react-native-community/netinfo';
import { api } from '@/services/api/client';
import { describeError, toApiError } from '@/services/api/errors';
import { queryClient } from '@/services/queryClient';
import { scopedKey } from '@/store/scopedKey';
import { currentScope } from './paths';
import { getOutbox, setOutbox, type OutboxItem } from './store';

/**
 * Completions recorded on the device and delivered to the Sailix gateway when possible (the gateway, not the app, builds
 * the Tala payload). Items survive restarts; they are scoped to organization+membership and wiped on sign-out.
 * Delivery never blocks the UI and never drops an item because of a transient problem.
 */
export async function queueCompletion(assignId: string, materialId: string): Promise<void> {
  const scope = currentScope();
  const items = await getOutbox(scope);
  if (items.some((i) => i.assignId === assignId && i.materialId === materialId)) return; // idempotent
  items.push({
    assignId,
    materialId,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  });
  await setOutbox(scope, items);
}

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

async function run(): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, kept: 0, dropped: 0, stopped: null };
  const scope = currentScope();
  let items = await getOutbox(scope);
  if (items.length === 0) return result;
  if (!(await NetInfo.fetch()).isConnected)
    return { ...result, kept: items.length, stopped: 'offline' };

  const byCourse = new Map<string, OutboxItem[]>();
  for (const i of items) byCourse.set(i.assignId, [...(byCourse.get(i.assignId) ?? []), i]);

  for (const [assignId, group] of byCourse) {
    if (currentScope() !== scope) break; // the session changed while we were sending: never touch another scope
    try {
      await api.post(`/modules/tala/courses/${encodeURIComponent(assignId)}/progress`, {
        completed: group.map((g) => g.materialId),
      });
      items = items.filter((i) => !group.includes(i));
      result.sent += group.length;
      await queryClient.invalidateQueries({ queryKey: scopedKey('tala') });
    } catch (e) {
      const err = toApiError(e);
      const message = describeError(e);
      if (err.kind === 'network' || (err.status !== undefined && err.status >= 500)) {
        group.forEach((g) => ((g.attempts += 1), (g.lastError = message)));
        result.stopped = 'offline';
        break; // the same would happen for the next course: try again later
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
        continue; // try this course on the next run
      }
      // 404 / 422: this completion can never be accepted (material gone, unsupported): drop it, do not loop forever
      items = items.filter((i) => !group.includes(i));
      result.dropped += group.length;
    }
  }

  if (currentScope() === scope) await setOutbox(scope, items);
  result.kept = items.length;
  return result;
}
