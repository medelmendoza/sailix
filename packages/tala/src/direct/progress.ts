import { assignments, findAssignment, type TalaContext } from './context';
import { parseDeck } from './deck';
import { isObject, materials, toInt, type Json, type MaterialSummary } from './mapping';
import { invalid, notFound, TalaProblem } from './problem';
import { parseQuiz } from './quiz';

/**
 * Progress written back to Tala (WRITES; closed while `progressWrites` is off). A port of the gateway's writeSnapshot:
 * Tala REPLACES the whole set of rows with what it is sent and stores progress exactly as sent, so the payload is built
 * from Tala's own stored snapshot of this user, every existing row is carried over, and the course counters are recomputed
 * here. One update per account at a time; never retried.
 */

type Item = Json & { materials: Record<'videos' | 'cards' | 'quizzes' | 'epubs' | 'pdfs', Json[]> };
type Mutation = (item: Item) => Promise<void> | void;

const busy = new Set<string>();

/** Course-level sync item from Tala's own stored snapshot, restricted to the fields the Tala app itself posts. */
function syncItem(snapshot: Json, assignment: Json): Item {
  const keep = ['assignId', 'courseId', 'courseName', 'courseDescription', 'userId', 'teamId', 'lastName', 'firstName', 'middleName',
    'dateFrom', 'dateTo', 'dateAssigned', 'assignedBy', 'email', 'status', 'progress', 'syncDate', 'courseTags', 'userTags'];
  const hasSnapshot = Object.keys(snapshot).length > 0;
  const source = hasSnapshot ? snapshot : assignment;
  const item: Json = Object.fromEntries(keep.filter((k) => k in source).map((k) => [k, source[k]]));
  if (!hasSnapshot) {
    // Never synced: Tala holds no snapshot yet, so the course-level record is built from the assignment itself
    const c = isObject(assignment.course) ? assignment.course : {};
    const s = (v: unknown) => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : '');
    item.courseName = s(c.courseName);
    item.courseDescription = s(c.courseDescription);
    item.courseTags = s(c.tags);
    item.userTags = s(assignment.userTags);
    item.syncDate = '';
    item.status = 'NOT YET COMPLETED';
    item.progress = `0/${toInt(c.totalMaterial)}`;
  }
  const all = isObject(snapshot.materials) ? snapshot.materials : {};
  const groups = {} as Item['materials'];
  for (const g of ['videos', 'cards', 'quizzes', 'epubs', 'pdfs'] as const) {
    groups[g] = (Array.isArray(all[g]) ? (all[g] as unknown[]) : []).filter(isObject);
  }
  return { ...item, materials: groups };
}

async function writeSnapshot(
  ctx: TalaContext,
  assignId: string,
  prepare: (visible: Map<string, MaterialSummary>) => Mutation,
): Promise<{ progress: string; status: string }> {
  if (!ctx.progressWrites) throw new TalaProblem('feature_disabled', 'Submitting progress is not enabled.', 403);

  const assignment = findAssignment(await assignments(ctx), assignId);
  const visibleList = materials(assignment, ctx.progressWrites).visible;
  const visible = new Map(visibleList.map((m) => [m.id, m]));
  const mutate = prepare(visible);

  const lock = `${ctx.userId}:${ctx.teamId}`;
  if (busy.has(lock)) throw new TalaProblem('progress_busy', 'Another update is in progress. Try again.', 409);
  busy.add(lock);
  try {
    const snapshot = await ctx.client.progress(ctx.userId, ctx.teamId, String(assignment.courseId ?? ''), assignId);
    const item = syncItem(snapshot, assignment);
    await mutate(item);

    const c = isObject(assignment.course) ? assignment.course : {};
    const total = toInt(c.totalMaterial) || visibleList.length;
    let done = 0;
    for (const group of Object.values(item.materials)) {
      for (const row of group) done += row.status === 'COMPLETED' ? 1 : 0;
    }
    const before = toInt(String(snapshot.progress ?? '0/0').split('/')[0]);
    done = Math.max(done, before); // completion never goes backwards
    item.progress = `${done}/${total}`;
    item.status = done >= total ? 'COMPLETED' : 'NOT YET COMPLETED';

    await ctx.client.submitSync(ctx.userId, ctx.teamId, item);
    return { progress: item.progress as string, status: item.status as string };
  } finally {
    busy.delete(lock);
  }
}

/** Free text typed by the user, stored in Tala: plain text only, bounded, "N/A" when empty (as the Tala app does). */
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const cleanComment = (v: unknown) => {
  const text = typeof v === 'string' ? v.replace(CONTROL, '').trim() : '';
  return text === '' ? 'N/A' : text.slice(0, 1000);
};

/** A material the user completed that Tala has no stored row for yet: built from Tala's own metadata. */
async function newMaterialRow(ctx: TalaContext, kind: 'videos' | 'pdfs', id: string): Promise<Json> {
  const raw = await ctx.client.material(ctx.teamId, kind === 'videos' ? 'videos' : 'pdf', id);
  const p = kind === 'videos' ? 'video' : 'pdf';
  const row: Json = {
    [`${p}Id`]: id,
    [`${p}Name`]: raw[`${p}Name`] ?? '',
    [`${p}Description`]: raw[`${p}Description`] ?? '',
    [`${p}FileUrl`]: raw[`${p}FileUrl`] ?? '',
    [`${p}FileName`]: raw[`${p}FileName`] ?? '',
    [`${p}ThumbnailUrl`]: raw[`${p}ThumbnailUrl`] ?? '',
    status: 'COMPLETED',
    progress: '',
    tags: raw.tags ?? '',
  };
  if (kind === 'videos') Object.assign(row, { feedback: 0, comment: '' });
  return row;
}

/** Replaces the stored row with this id (a retake) or adds it. */
function putRow(rows: Json[], idKey: string, id: string, row: Json) {
  let replaced = false;
  rows.forEach((existing, i) => {
    if (existing[idKey] === id) {
      rows[i] = row;
      replaced = true;
    }
  });
  if (!replaced) rows.push(row);
}

export type VideoFeedback = Record<string, { rating?: unknown; comment?: unknown }>;

/**
 * Marks the user's own video/PDF materials as completed. The payload is built from Tala's own stored snapshot: the caller
 * only names material ids. Video feedback (star rating, half steps, and a comment) may accompany the video ids it belongs to.
 */
export async function submitProgress(
  ctx: TalaContext,
  assignId: string,
  materialIds: string[],
  feedback: VideoFeedback = {},
) {
  const ids = [...new Set(materialIds)];
  const result = await writeSnapshot(ctx, assignId, (visible) => {
    for (const id of ids) {
      const summary = visible.get(id);
      if (!summary) throw notFound('Material not found.');
      if (summary.type !== 'video' && summary.type !== 'pdf') {
        throw invalid('unsupported_material', 'Quizzes and flashcards have their own screens.');
      }
    }
    for (const [id, f] of Object.entries(feedback)) {
      const rating = isObject(f) ? f.rating : null;
      const n = Number(rating);
      if (!ids.includes(id) || visible.get(id)?.type !== 'video' || rating === null || rating === undefined || rating === '' || Number.isNaN(n) || n < 1 || n > 5 || (n * 2) % 1 !== 0) {
        throw invalid('invalid_feedback', 'Feedback belongs to a video you are completing and needs a rating from 1 to 5.');
      }
    }
    return async (item) => {
      for (const id of ids) {
        const kind = visible.get(id)!.type === 'video' ? 'videos' : 'pdfs';
        const idKey = kind === 'videos' ? 'videoId' : 'pdfId';
        const rows = item.materials[kind];
        let index = -1;
        rows.forEach((row, i) => {
          if (row[idKey] === id) {
            row.status = 'COMPLETED';
            index = i;
          }
        });
        if (index === -1) index = rows.push(await newMaterialRow(ctx, kind, id)) - 1;
        const f = feedback[id];
        if (f) {
          rows[index]!.feedback = Number(f.rating);
          rows[index]!.comment = cleanComment(f.comment);
        }
      }
    };
  });
  return { ...result, completed: ids };
}

/** Scores the answers on the device with the key Tala sent, then records the result in Tala. Returns totals only. */
export async function submitQuiz(
  ctx: TalaContext,
  assignId: string,
  quizId: string,
  version: string | null,
  answers: unknown[],
) {
  let scored: ReturnType<ReturnType<typeof parseQuiz>['score']> | null = null;
  const progress = await writeSnapshot(ctx, assignId, (visible) => {
    if (visible.get(quizId)?.type !== 'quiz') throw notFound('Quiz not found.');
    return async (item) => {
      const quiz = parseQuiz(await ctx.client.quiz(ctx.teamId, quizId));
      if (version !== null && version !== quiz.version()) {
        throw new TalaProblem('quiz_changed', 'This quiz was updated. Reload it and try again.', 409);
      }
      scored = quiz.score(answers);
      putRow(item.materials.quizzes, 'quizId', quizId, quiz.syncRow(scored));
    };
  });
  const s = scored!;
  return { ...progress, correct: s.correct, wrong: s.wrong, total: s.total, average: s.average, passed: s.passed };
}

/** Records a COMPLETE set of ratings for a flashcard set, as the Tala app does: only when the set is finished. */
export async function submitFlashcards(
  ctx: TalaContext,
  assignId: string,
  cardId: string,
  version: string | null,
  ratings: unknown[],
) {
  let counts = { easy: 0, medium: 0, hard: 0 };
  const progress = await writeSnapshot(ctx, assignId, (visible) => {
    if (visible.get(cardId)?.type !== 'flashcards') throw notFound('Flashcard set not found.');
    return async (item) => {
      const deck = parseDeck(await ctx.client.deck(ctx.teamId, cardId));
      if (version !== null && version !== deck.version()) {
        throw new TalaProblem('deck_changed', 'This flashcard set was updated. Reload it and rate again.', 409);
      }
      const valid = deck.validateRatings(ratings);
      counts = { easy: 0, medium: 0, hard: 0 };
      for (const r of valid) counts[r]++;
      putRow(item.materials.cards, 'cardId', cardId, deck.syncRow(valid));
    };
  });
  return { ...progress, ...counts };
}

