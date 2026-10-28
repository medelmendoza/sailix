import type { TalaClient } from './client';
import { isObject, materials, type Json } from './mapping';
import { notFound } from './problem';

/** Who is asking: every Tala call is made with the signed-in user and the chosen team, never with ids a screen supplies. */
export interface TalaContext {
  client: TalaClient;
  userId: string;
  teamId: string;
  /** `TALA_PROGRESS_WRITES`: progress, quizzes, flashcards and joining a course are closed while it is off. */
  progressWrites: boolean;
}

export async function assignments(ctx: TalaContext): Promise<Json[]> {
  return (await ctx.client.courses(ctx.userId, ctx.teamId)).filter(isObject);
}

export function findAssignment(list: Json[], assignId: string): Json {
  return list.find((a) => a.assignId === assignId) ?? (() => { throw notFound('Course not found.'); })();
}

/** A material of the given type that belongs to this course, or "not found". */
export function assertMaterial(ctx: TalaContext, assignment: Json, id: string, type: string, what: string) {
  const summary = materials(assignment, ctx.progressWrites).visible.find((m) => m.id === id);
  if (!summary || summary.type !== type) throw notFound(`${what} not found.`);
  return summary;
}
