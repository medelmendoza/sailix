import { TalaError, type TalaClient } from '../direct/client';
import type { TalaSession } from '../direct/auth';
import type { TalaContext } from '../direct/context';
import { submitFlashcards, submitProgress, submitQuiz, type VideoFeedback } from '../direct/progress';
import { courseDetail, courses, flashcardsView, joinCourse, material, quizView } from '../direct/reads';
import type {
  TalaCourse,
  TalaCourseDetail,
  TalaDeck,
  TalaFlashcardResult,
  TalaMaterial,
  TalaQuiz,
  TalaQuizResult,
} from '../types';

/** Everything the screens ask of Tala. One implementation today (straight to the Tala server). */
export interface TalaDataSource {
  /** The signed-in learner's name, for the welcome. */
  profile(): Promise<{ firstName: string | null; lastName: string | null }>;
  courses(): Promise<TalaCourse[]>;
  course(assignId: string): Promise<TalaCourseDetail>;
  material(assignId: string, materialId: string): Promise<TalaMaterial>;
  quiz(assignId: string, quizId: string): Promise<TalaQuiz>;
  submitQuiz(assignId: string, quizId: string, version: string | null, answers: unknown[]): Promise<TalaQuizResult>;
  flashcards(assignId: string, cardId: string): Promise<TalaDeck>;
  submitRatings(
    assignId: string,
    cardId: string,
    version: string | null,
    ratings: unknown[],
  ): Promise<TalaFlashcardResult>;
  submitProgress(assignId: string, materialIds: string[], feedback?: VideoFeedback): Promise<unknown>;
  joinCourse(code: string): Promise<void>;
}

export function createDirectSource(
  client: TalaClient,
  session: TalaSession,
  progressWrites: boolean,
): TalaDataSource {
  /** The signed-in user and the chosen team; without them there is nothing to ask Tala for. */
  async function ctx(): Promise<TalaContext> {
    const s = await session.current();
    if (!s || !s.teamId) throw new TalaError('unauthorized');
    return { client, userId: s.userId, teamId: s.teamId, progressWrites };
  }
  const cast = <T>(v: unknown) => v as T;
  return {
    profile: async () => client.profile((await ctx()).userId),
    courses: async () => cast<TalaCourse[]>(await courses(await ctx())),
    course: async (a) => cast<TalaCourseDetail>(await courseDetail(await ctx(), a)),
    material: async (a, m) => cast<TalaMaterial>(await material(await ctx(), a, m)),
    quiz: async (a, q) => cast<TalaQuiz>(await quizView(await ctx(), a, q)),
    submitQuiz: async (a, q, v, answers) => cast<TalaQuizResult>(await submitQuiz(await ctx(), a, q, v, answers)),
    flashcards: async (a, c) => cast<TalaDeck>(await flashcardsView(await ctx(), a, c)),
    submitRatings: async (a, c, v, r) => cast<TalaFlashcardResult>(await submitFlashcards(await ctx(), a, c, v, r)),
    submitProgress: async (a, ids, f) => submitProgress(await ctx(), a, ids, f),
    joinCourse: async (code) => void (await joinCourse(await ctx(), code)),
  };
}
