import type { TalaMaterialSummary } from '../types';

export const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
};
export const isDone = (m: TalaMaterialSummary) => m.status?.toUpperCase() === 'COMPLETED';

/** Tala's status words are shouted and some mean nothing to a learner; say only what helps. */
export function statusWord(status: string | null): string | null {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'DEFAULT' || s === 'NOT STARTED' || s === 'NOT YET COMPLETED' || s === 'INACTIVE')
    return null;
  return status;
}

/** What the learner achieved on one item, from Tala's stored record. */
export function materialStatsLine(m: TalaMaterialSummary): string | null {
  const s = m.stats;
  if (!s) return null;
  if (m.type === 'video' && typeof s.rating === 'number') return `Your rating: ${s.rating} of 5`;
  if (m.type === 'quiz' && typeof s.average === 'number') {
    const verdict =
      s.remarks === 'PASSED' ? 'Passed' : s.remarks === 'FAILED' ? 'Not passed' : null;
    return `Score ${s.average}%${verdict ? ` · ${verdict}` : ''} (${s.correct ?? 0} correct, ${s.wrong ?? 0} wrong)`;
  }
  if (m.type === 'flashcards' && (s.easy ?? 0) + (s.medium ?? 0) + (s.hard ?? 0) > 0) {
    return `Easy ${s.easy ?? 0} · Medium ${s.medium ?? 0} · Hard ${s.hard ?? 0}`;
  }
  return null;
}
