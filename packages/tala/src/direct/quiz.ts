import { fingerprint, isObject, type Json } from './mapping';
import { invalid } from './problem';

/**
 * A Tala quiz ("up_quiz") parsed for scoring: a port of TalaQuiz.php. Tala ships the answer key to whoever fetches the
 * quiz, so in the standalone package the DEVICE scores. The key lives only inside this object, held in memory for the
 * attempt; `publicView` is what screens get (questions only). Anything not fully understood is refused as `unsupported_quiz`.
 */
const MAX_QUESTIONS = 200;

interface Question {
  ref: string;
  kind: 'single' | 'multiple' | 'text';
  text: string;
  choices: string[];
  required: boolean;
  mediaType: string | null;
  mediaUrl: string | null;
  answerKey: number[] | string;
  source: Json;
}
interface Section {
  source: Json;
  questions: Question[];
}
export interface QuizScore {
  correct: number;
  wrong: number;
  total: number;
  average: number;
  passed: boolean;
  byRef: Record<string, { user: string; correct: boolean }>;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null;
const unsupported = () => invalid('unsupported_quiz', 'This quiz cannot be taken in this version of the app.');
const isIndex = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && /^\d{1,2}$/.test(String(v));
/** Tala's comparison: trimmed, all whitespace removed, upper-cased. */
const normalize = (s: string) => s.trim().replace(/\s+/gu, '').toUpperCase();
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const isHttps = (u: string) => {
  if (!/^https:\/\//i.test(u)) return false;
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
};

function question(ref: string, q: Json): Question {
  const type = String(q.questionType ?? '');
  const kind = type === 'multipleChoice' ? 'single' : type === 'checkbox' ? 'multiple' : 'text';
  const text = str(q.question);
  const answer = str(q.answer);
  if (text === null || answer === null) throw unsupported();

  let choices: string[] = [];
  let key: number[] | string;
  if (kind !== 'text') {
    choices = String(q.choices ?? '').split(':');
    if (choices.length < 2 || choices.length > 12 || choices.includes('')) throw unsupported();
    const indices = answer.split(':');
    // indices are 0-based in every quiz observed: anything else is not scored on a guess
    if (indices.some((i) => !/^\d{1,2}$/.test(i) || Number(i) >= choices.length)) throw unsupported();
    key = [...new Set(indices.map(Number))].sort((a, b) => a - b);
    if (kind === 'single' && key.length !== 1) throw unsupported();
  } else {
    key = normalize(answer);
  }
  const media = str(q.mediaUploaded);
  return {
    ref,
    kind,
    text,
    choices,
    required: [true, '1', 'true', 'on', 'yes'].includes(
      typeof q.required === 'string' ? q.required.toLowerCase() : (q.required as boolean),
    ),
    mediaType: str(q.mediaType),
    mediaUrl: media !== null && isHttps(media) ? media : null,
    answerKey: key,
    source: q,
  };
}

export function parseQuiz(raw: Json) {
  const id = typeof raw.quizId === 'string' ? raw.quizId : null;
  const pass = raw.quizPercentage;
  if (id === null || pass === '' || pass === null || Number.isNaN(Number(pass)) || !Array.isArray(raw.arraySection) || raw.arraySection.length === 0) {
    throw unsupported();
  }
  const sections: Section[] = [];
  let count = 0;
  raw.arraySection.forEach((section: unknown, si: number) => {
    if (!isObject(section) || !Array.isArray(section.data)) throw unsupported();
    const questions = section.data.map((q: unknown, qi: number) => {
      if (!isObject(q) || ++count > MAX_QUESTIONS) throw unsupported();
      return question(`${si}.${qi}`, q);
    });
    sections.push({ source: section, questions });
  });
  const name = String(raw.quizName ?? '');
  const description = str(raw.quizDescription);
  const passMark = Number(pass);

  const version = () =>
    fingerprint(sections.map((s) => s.questions.map((q) => [q.ref, q.kind, q.text, q.choices])));

  function mark(q: Question, value: unknown): [boolean, string] {
    const index = (v: unknown) => {
      if (!isIndex(v) || Number(v) >= q.choices.length) throw invalid('invalid_answers', 'That option does not exist.');
      return Number(v);
    };
    if (q.kind === 'single') {
      const i = index(value);
      return [sameSet([i], q.answerKey as number[]), q.choices[i]!];
    }
    if (q.kind === 'multiple') {
      if (!Array.isArray(value) || value.length === 0 || value.length > q.choices.length) {
        throw invalid('invalid_answers', 'Choose at least one option.');
      }
      const set = [...new Set(value.map(index))].sort((a, b) => a - b);
      return [sameSet(set, q.answerKey as number[]), `[${set.map((i) => q.choices[i]).join(', ')}]`];
    }
    if (typeof value !== 'string' || value.trim() === '' || value.length > 1000) {
      throw invalid('invalid_answers', 'Enter an answer.');
    }
    return [normalize(value) === q.answerKey, value.trim()];
  }

  return {
    id,
    name,
    description,
    passMark,
    version,

    /** What screens may see: questions and choices, never answers. */
    publicView() {
      return {
        id,
        name,
        description,
        version: version(),
        sections: sections.map((s, i) => ({
          id: str(s.source.sectionId) ?? String(i),
          title: str(s.source.sectionTitle),
          description: str(s.source.sectionDescription),
          questions: s.questions.map((q) => ({
            ref: q.ref,
            type: q.kind,
            text: q.text,
            choices: q.choices,
            required: q.required,
            media_type: q.mediaUrl !== null ? q.mediaType : null,
            media_url: q.mediaUrl,
          })),
        })),
      };
    },

    score(answers: unknown[]): QuizScore {
      const given = new Map<string, unknown>();
      for (const a of answers) {
        const ref = isObject(a) && typeof a.ref === 'string' ? a.ref : null;
        if (ref === null || given.has(ref)) throw invalid('invalid_answers', 'Each question must be answered exactly once.');
        given.set(ref, (a as Json).value ?? null);
      }
      const byRef: QuizScore['byRef'] = {};
      let correct = 0;
      let total = 0;
      for (const s of sections) {
        for (const q of s.questions) {
          total++;
          if (!given.has(q.ref)) throw invalid('incomplete_answers', 'Please answer every question.');
          const [ok, user] = mark(q, given.get(q.ref));
          byRef[q.ref] = { user, correct: ok };
          correct += ok ? 1 : 0;
        }
      }
      if (given.size !== total) throw invalid('invalid_answers', 'Unknown question in the answers.');
      const average = Math.round((correct / total) * 100 * 100) / 100;
      return { correct, wrong: total - correct, total, average, passed: average >= passMark, byRef };
    },

    /** The quiz row for Tala's sync payload, in the shape the Tala app itself posts. */
    syncRow(score: QuizScore): Json {
      return {
        quizId: id,
        quizName: name,
        quizDescription: description ?? '',
        quizThumbnailUrl: str(raw.quizThumbnailUrl) ?? '',
        status: 'COMPLETED',
        quizPercentage: String(raw.quizPercentage),
        correct: score.correct,
        wrong: score.wrong,
        average: score.average,
        remarks: score.passed ? 'PASSED' : 'FAILED',
        progress: '',
        tags: str(raw.tags) ?? '',
        sections: sections.map((s) => ({
          sectionId: str(s.source.sectionId) ?? '',
          sectionTitle: str(s.source.sectionTitle) ?? '',
          sectionDescription: str(s.source.sectionDescription) ?? '',
          sectionMediaType: str(s.source.sectionMediaType) ?? '',
          sectionMedia: str(s.source.sectionMedia) ?? '',
          pagePerSection: str(s.source.pagePerSection) ?? '',
          data: s.questions.map((q) => ({
            tags: str(q.source.tags) ?? '',
            numQuestion: str(q.source.numQuestion) ?? '',
            questionType: str(q.source.questionType) ?? '',
            question: q.text,
            answer: str(q.source.answer) ?? '',
            choices: str(q.source.choices) ?? '',
            mediaType: str(q.source.mediaType) ?? '',
            mediaUploaded: str(q.source.mediaUploaded) ?? '',
            required: str(q.source.required) ?? '',
            userAnswer: score.byRef[q.ref]!.user,
            result: score.byRef[q.ref]!.correct ? 'CORRECT' : 'WRONG',
          })),
        })),
      };
    },
  };
}

export type ParsedQuiz = ReturnType<typeof parseQuiz>;
