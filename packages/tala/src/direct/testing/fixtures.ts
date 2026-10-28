import { TalaError, type TalaClient } from '../client';

/** Shapes observed in T0 with invented values: the same raw Tala payloads the PHP gateway tests use. */
export type Json = Record<string, unknown>;

export const assignment = (course: Json = {}): Json => ({
  assignId: 'A1',
  courseId: 'C1',
  dateFrom: '2026-01-01',
  dateTo: '2026-12-31',
  status: 'NOT YET COMPLETED',
  progress: '2/5',
  course: {
    courseName: 'Safety at sea',
    courseDescription: 'Basics',
    courseThumbnailUrl: 'https://cdn.example.com/c.png',
    courseCreator: 'Capt. Reyes',
    totalMaterial: '5',
    materialDetails: [
      { materialId: 'v1', materialType: 'video', materialName: 'Intro video', materialDescription: 'd', materialThumbnailUrl: 'https://cdn.example.com/v.png' },
      { materialId: 'p1', materialType: 'pdf', materialName: 'Manual' },
      { materialId: 'q1', materialType: 'up_quiz', materialName: 'Quiz' },
      { materialId: 'e1', materialType: 'epub', materialName: 'Book' },
      { materialId: 'l1', materialType: 'quiz', materialName: 'Legacy quiz' },
      { materialId: 'c1', materialType: 'up_card', materialName: 'Knots' },
    ],
    ...course,
  },
});

export const snapshot = (over: Json = {}): Json => ({
  assignId: 'A1',
  courseId: 'C1',
  courseName: 'Safety at sea',
  userId: 'tala-user-1',
  teamId: 'TEAM-1',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@tala.example',
  status: 'NOT YET COMPLETED',
  progress: '1/5',
  createdAt: 'meta-should-not-be-forwarded',
  materials: {
    videos: [
      { videoId: 'v1', videoName: 'Intro video', status: 'DEFAULT', feedback: 0, comment: '', progress: '' },
      { videoId: 'v2', videoName: 'Other', status: 'COMPLETED', feedback: 4.5, comment: 'kept', progress: '' },
    ],
    pdfs: [],
    cards: [],
    quizzes: [],
    epubs: [],
  },
  ...over,
});

export const quizDoc = (over: Json = {}): Json => ({
  quizId: 'q1',
  quizName: 'Final quiz',
  quizDescription: 'd',
  quizPercentage: '70',
  tags: '',
  arraySection: [
    {
      sectionId: 's1',
      sectionTitle: 'Part 1',
      pagePerSection: '1',
      data: [
        { questionType: 'multipleChoice', numQuestion: '1', question: 'Which colour is a lifebuoy?', answer: '1', choices: 'blue:orange:green:black', required: 'true' },
        { questionType: 'multipleChoice', numQuestion: '2', question: 'Pick the safe action', answer: '3', choices: 'run:hide:wait:call', required: 'true' },
      ],
    },
  ],
  ...over,
});

export const deckDoc = (): Json => ({
  cardId: 'c1',
  cardName: 'Knots',
  cardDescription: 'd',
  cardThumbnailUrl: '',
  tags: '',
  data: [
    { tags: '', question: 'Bowline?', questionMediaType: 'image', questionMediaUploaded: 'https://cdn.example.com/b.png', answer: 'Rescue loop', answerMediaType: '', answerMediaUploaded: '' },
    { tags: '', question: 'Reef knot?', questionMediaType: '', questionMediaUploaded: '', answer: 'Joins two ropes', answerMediaType: '', answerMediaUploaded: '' },
  ],
});

type Answers = { assignments?: Json[]; snapshot?: Json; quiz?: Json; deck?: Json; syncError?: TalaError };

/** An in-memory Tala: answers the way the faked HTTP did, and records every snapshot posted to it. */
export function fakeClient(a: Answers = {}) {
  const posted: Json[] = [];
  const calls: string[] = [];
  const client = {
    login: async () => ({ accessToken: 't', refreshToken: null, userId: 'tala-user-1' }),
    teamIds: async () => ['TEAM-1'],
    courses: async () => (calls.push('courses'), a.assignments ?? [assignment()]),
    progress: async () => (calls.push('progress'), a.snapshot ?? snapshot()),
    deck: async () => (calls.push('deck'), a.deck ?? deckDoc()),
    quiz: async () => (calls.push('quiz'), a.quiz ?? quizDoc()),
    material: async (_t: string, kind: string, id: string) => (
      calls.push(`material:${kind}:${id}`),
      kind === 'pdf'
        ? { pdfName: 'Manual', pdfFileUrl: 'javascript:alert(1)' }
        : { videoName: 'Intro video', videoDescription: 'd', videoFileUrl: 'https://files.example.com/v.mp4', videoThumbnailUrl: 'http://insecure.example.com/t.png' }
    ),
    submitSync: async (_u: string, _t: string, item: Json) => {
      posted.push(JSON.parse(JSON.stringify(item)));
      if (a.syncError) throw a.syncError;
    },
    applyToCourse: async (_u: string, _t: string, code: string) => {
      calls.push(`apply:${code}`);
      if (code === 'BAD') throw new TalaError('course_code_rejected');
    },
  } as unknown as TalaClient;
  return { client, posted, calls };
}

export const ctxOf = (client: TalaClient, progressWrites = true) => ({
  client,
  userId: 'tala-user-1',
  teamId: 'TEAM-1',
  progressWrites,
});
