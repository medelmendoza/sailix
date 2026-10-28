import { useQuery } from '@tanstack/react-query';
import { toApiError } from '../errors';
import { currentScope, getRuntime, scopedKey } from '../runtime';
import {
  getCachedCourse,
  getCachedCourses,
  setCachedCourse,
  setCachedCourses,
} from '../offline/store';
import type {
  TalaCourse,
  TalaCourseDetail,
  TalaDeck,
  TalaFlashcardResult,
  TalaMaterial,
  TalaQuiz,
  TalaQuizResult,
} from '../types';

/**
 * Tala data goes ONLY through the data source of the running package (`getRuntime().source`). Query keys are scoped to the
 * signed-in Tala user and team (and the host's scope).
 */
const source = () => getRuntime().source;

/** What a screen shows: the data, and whether it is the saved copy (Tala or the network was unreachable). */
export type Offlineable<T> = { data: T; fromCache: boolean; fetchedAt: string | null };

/** Network failures and upstream outages fall back to the copy saved on this device; everything else is a real error. */
function usable(e: unknown): boolean {
  const err = toApiError(e);
  return err.kind === 'network' || (err.status !== undefined && err.status >= 500);
}

/** The learner's name for the welcome. Not essential: when it cannot be read the welcome simply has no name. */
export function useTalaProfile() {
  return useQuery({
    queryKey: scopedKey('tala', 'profile'),
    staleTime: 60 * 60 * 1000,
    queryFn: () => source().profile(),
  });
}

export function useTalaCourses() {
  return useQuery({
    queryKey: scopedKey('tala', 'courses'),
    queryFn: async (): Promise<Offlineable<TalaCourse[]>> => {
      const scope = currentScope();
      try {
        const courses = await source().courses();
        await setCachedCourses(scope, { fetchedAt: new Date().toISOString(), courses });
        return { data: courses, fromCache: false, fetchedAt: null };
      } catch (e) {
        const cached = usable(e) ? await getCachedCourses(scope) : null;
        if (cached) return { data: cached.courses, fromCache: true, fetchedAt: cached.fetchedAt };
        throw e;
      }
    },
  });
}

export function useTalaCourse(assignId: string) {
  return useQuery({
    queryKey: scopedKey('tala', 'course', assignId),
    queryFn: async (): Promise<Offlineable<TalaCourseDetail>> => {
      const scope = currentScope();
      try {
        const course = await source().course(assignId);
        await setCachedCourse(scope, assignId, { fetchedAt: new Date().toISOString(), course });
        return { data: course, fromCache: false, fetchedAt: null };
      } catch (e) {
        const cached = usable(e) ? await getCachedCourse(scope, assignId) : null;
        if (cached) return { data: cached.course, fromCache: true, fetchedAt: cached.fetchedAt };
        throw e;
      }
    },
  });
}

export const fetchTalaMaterial = (assignId: string, materialId: string): Promise<TalaMaterial> =>
  source().material(assignId, materialId);

/** A quiz is scored on the device from the quiz Tala sends: nothing about it is stored and an attempt needs a connection. */
export const fetchTalaQuiz = (assignId: string, quizId: string): Promise<TalaQuiz> =>
  source().quiz(assignId, quizId);

export type QuizAnswer = { ref: string; value: string | string[] };

export const submitTalaQuiz = (
  assignId: string,
  quizId: string,
  version: string,
  answers: QuizAnswer[],
): Promise<TalaQuizResult> => source().submitQuiz(assignId, quizId, version, answers);

/** Flashcard sets: study material (no answer key), cached for offline study; results are sent as one complete set. */
export const fetchTalaDeck = (assignId: string, cardId: string): Promise<TalaDeck> =>
  source().flashcards(assignId, cardId);

export type CardRating = { index: number; rating: 'easy' | 'medium' | 'hard' };

export const submitTalaRatings = (
  assignId: string,
  cardId: string,
  version: string | null,
  ratings: CardRating[],
): Promise<TalaFlashcardResult> => source().submitRatings(assignId, cardId, version, ratings);

/** Applies to join a course by its code. Tala usually needs an administrator to approve, so this means "requested". */
export const joinTalaCourse = (code: string): Promise<void> => source().joinCourse(code);
