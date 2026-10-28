import { course, materialStats, materials, parseProgress, progressById } from '../mapping';
import { assignment } from '../testing/fixtures';

describe('mapping: the course list', () => {
  it('maps an assignment to the course the screens show', () => {
    expect(course(assignment(), true)).toMatchObject({
      id: 'A1',
      name: 'Safety at sea',
      description: 'Basics',
      thumbnail_url: 'https://cdn.example.com/c.png',
      creator: 'Capt. Reyes',
      date_from: '2026-01-01',
      date_to: '2026-12-31',
      status: 'NOT YET COMPLETED',
      progress: '2/5',
      completed: 2,
      total: 5,
      percent: 40,
      state: 'in_progress',
      total_materials: 4,
    });
  });

  it('gives a course never started zero progress from its own material count', () => {
    const a = { ...assignment(), progress: null };
    expect(course(a, true)).toMatchObject({ completed: 0, total: 5, percent: 0, state: 'not_started' });
  });

  it('calls a COMPLETED status completed', () => {
    expect(course({ ...assignment(), status: 'completed', progress: '5/5' }, true)).toMatchObject({ state: 'completed', percent: 100 });
  });

  it('passes on only https links and real dates', () => {
    const a = assignment({ courseThumbnailUrl: 'javascript:alert(1)' });
    a.dateFrom = '2026-02-30';
    expect(course(a, true)).toMatchObject({ thumbnail_url: null, date_from: null });
  });
});

describe('mapping: materials', () => {
  it('shows video, pdf, quiz and flashcards, and counts the rest as hidden', () => {
    const { visible, hidden } = materials(assignment(), true);
    expect(visible.map((m) => [m.id, m.type])).toEqual([
      ['v1', 'video'],
      ['p1', 'pdf'],
      ['q1', 'quiz'],
      ['c1', 'flashcards'],
    ]);
    expect(hidden).toBe(2); // the epub and the legacy quiz
  });

  it('makes quizzes and flashcards viewable only while progress writes are on', () => {
    const view = (w: boolean) => materials(assignment(), w).visible.map((m) => m.viewable);
    expect(view(true)).toEqual([true, true, true, true]);
    expect(view(false)).toEqual([true, true, false, false]);
  });

  it('hides a material whose id is not a plain id', () => {
    const a = assignment();
    (a.course as { materialDetails: unknown[] }).materialDetails.push({ materialId: '../x', materialType: 'video' });
    expect(materials(a, true).hidden).toBe(3);
  });

  it('reads Tala done/total, and falls back to the course total otherwise', () => {
    expect(parseProgress(' 3 / 9 ', 5)).toEqual([3, 9]);
    expect(parseProgress('nonsense', 5)).toEqual([0, 5]);
    expect(parseProgress(null, -1)).toEqual([0, 0]);
  });
});

describe('mapping: stored progress and stats', () => {
  it('indexes the stored rows by material id with what the learner achieved', () => {
    const out = progressById({
      materials: {
        videos: [{ videoId: 'v1', progress: '100', status: 'done', feedback: 4.5 }],
        quizzes: [{ quizId: 'q1', correct: 3, wrong: '1', average: 75.456, remarks: 'PASSED' }],
        cards: [{ cardId: 'c1', easy: 1, medium: 0, hard: 1, notseen: 0 }],
        pdfs: [{ pdfId: 'p1', status: 'COMPLETED' }],
      },
    });
    expect(out.v1).toEqual({ progress: '100', status: 'done', stats: { rating: 4.5 } });
    expect(out.q1?.stats).toEqual({ correct: 3, wrong: 1, average: 75.46, remarks: 'PASSED' });
    expect(out.c1?.stats).toEqual({ easy: 1, medium: 0, hard: 1, notseen: 0 });
    expect(out.p1?.stats).toBeNull();
  });

  it('ignores an unrated video, a bad remark and negative counts', () => {
    expect(materialStats('videos', { feedback: 0 })).toEqual({ rating: null });
    expect(materialStats('quizzes', { correct: -4, remarks: 'MAYBE' })).toEqual({
      correct: 0,
      wrong: 0,
      average: null,
      remarks: null,
    });
  });

  it('copes with a snapshot that has no materials', () => {
    expect(progressById({})).toEqual({});
  });
});
