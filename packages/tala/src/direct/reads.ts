import { TalaError } from './client';
import { assertMaterial, assignments, findAssignment, type TalaContext } from './context';
import { parseDeck } from './deck';
import { course, https, isObject, materials, progressById, str, type Json } from './mapping';
import { invalid, notFound, TalaProblem } from './problem';
import { parseQuiz } from './quiz';

/** The read side of the gateway (courses, a course, a material, a quiz or deck to study) and joining a course. */

const closed = (what: string) => new TalaProblem('feature_disabled', `${what} is not enabled.`, 403);

export async function courses(ctx: TalaContext) {
  return (await assignments(ctx)).map((a) => course(a, ctx.progressWrites));
}

/** Applies to join a course by code (a write). The code is never kept, and a wrong code is one plain message. */
export async function joinCourse(ctx: TalaContext, code: string): Promise<{ status: 'requested' }> {
  if (!ctx.progressWrites) throw closed('Joining a course');
  try {
    await ctx.client.applyToCourse(ctx.userId, ctx.teamId, code);
  } catch (e) {
    if (e instanceof TalaError && e.kind === 'course_code_rejected') {
      throw invalid('course_code_rejected', 'That course code was not accepted.');
    }
    throw e;
  }
  return { status: 'requested' };
}

export async function courseDetail(ctx: TalaContext, assignId: string) {
  const assignment = findAssignment(await assignments(ctx), assignId);
  const { visible, hidden } = materials(assignment, ctx.progressWrites);
  let stored: Json = {};
  try {
    stored = await ctx.client.progress(ctx.userId, ctx.teamId, String(assignment.courseId ?? ''), assignId);
  } catch (e) {
    // progress is a nice-to-have: show the course without it rather than failing the screen
    if (!(e instanceof TalaError && e.kind === 'unavailable')) throw e;
  }
  const progress = progressById(stored);
  const c = isObject(assignment.course) ? assignment.course : {};
  return {
    ...course(assignment, ctx.progressWrites),
    materials: visible.map((m) => ({
      ...m,
      progress: progress[m.id]?.progress ?? null,
      status: progress[m.id]?.status ?? null,
      stats: progress[m.id]?.stats ?? null,
    })),
    hidden_materials: hidden,
    progress_submission: ctx.progressWrites,
    // Tala's "sequential" course: the materials are meant to be done in order
    sequential: ['yes', 'true', '1', 'y'].includes(String(c.sequential ?? '').trim().toLowerCase()),
  };
}

export async function material(ctx: TalaContext, assignId: string, materialId: string) {
  const assignment = findAssignment(await assignments(ctx), assignId);
  const summary = materials(assignment, ctx.progressWrites).visible.find((m) => m.id === materialId);
  if (!summary) throw notFound('Material not found.');
  if (summary.type === 'quiz' || summary.type === 'flashcards') {
    throw invalid('unsupported_material', 'This item has no file to open.');
  }
  const prefix = summary.type === 'video' ? 'video' : 'pdf';
  const raw = await ctx.client.material(ctx.teamId, summary.type === 'video' ? 'videos' : 'pdf', materialId);
  return {
    id: materialId,
    type: summary.type,
    name: str(raw[`${prefix}Name`]) ?? summary.name,
    description: str(raw[`${prefix}Description`]),
    thumbnail_url: https(raw[`${prefix}ThumbnailUrl`]),
    file_url: https(raw[`${prefix}FileUrl`]),
  };
}

/** The questions of one quiz of the caller's own course. Never contains an answer or the answer key. */
export async function quizView(ctx: TalaContext, assignId: string, quizId: string) {
  if (!ctx.progressWrites) throw closed('Quizzes');
  const assignment = findAssignment(await assignments(ctx), assignId);
  assertMaterial(ctx, assignment, quizId, 'quiz', 'Quiz');
  return parseQuiz(await ctx.client.quiz(ctx.teamId, quizId)).publicView();
}

/** The cards of one flashcard set, with any ratings Tala already holds for them. */
export async function flashcardsView(ctx: TalaContext, assignId: string, cardId: string) {
  if (!ctx.progressWrites) throw closed('Flashcards');
  const assignment = findAssignment(await assignments(ctx), assignId);
  assertMaterial(ctx, assignment, cardId, 'flashcards', 'Material');
  const deck = parseDeck(await ctx.client.deck(ctx.teamId, cardId));
  let stored: Json | null = null;
  try {
    const snapshot = await ctx.client.progress(ctx.userId, ctx.teamId, String(assignment.courseId ?? ''), assignId);
    const rows = isObject(snapshot.materials) && Array.isArray(snapshot.materials.cards) ? snapshot.materials.cards : [];
    for (const row of rows) if (isObject(row) && row.cardId === cardId) stored = row;
  } catch (e) {
    // resuming earlier ratings is a nicety: study works without it
    if (!(e instanceof TalaError && e.kind === 'unavailable')) throw e;
  }
  return deck.publicView(stored);
}
