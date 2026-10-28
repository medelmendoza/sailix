import { TalaError } from '../client';
import { TalaProblem } from '../problem';
import { submitFlashcards, submitProgress, submitQuiz } from '../progress';
import { assignment, ctxOf, fakeClient, quizDoc, snapshot, type Json } from '../testing/fixtures';

const fail = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as TalaProblem | TalaError | null;
const codeOf = async (p: Promise<unknown>) => ((await fail(p)) as TalaProblem).code;
type Item = { materials: Record<string, Json[]> } & Json;
const lastItem = (posted: Json[]) => posted[0] as Item;

describe('progress writes', () => {
  it('is closed while writes are off and never reaches Tala', async () => {
    const { client, calls, posted } = fakeClient();
    expect(await codeOf(submitProgress(ctxOf(client, false), 'A1', ['v1']))).toBe('feature_disabled');
    expect(calls).toEqual([]);
    expect(posted).toEqual([]);
  });

  it('marks the named video completed inside the stored snapshot and keeps the other rows', async () => {
    const { client, posted } = fakeClient();
    const out = await submitProgress(ctxOf(client), 'A1', ['v1']);
    expect(out).toMatchObject({ progress: '2/5', status: 'NOT YET COMPLETED', completed: ['v1'] });
    const item = lastItem(posted);
    expect(item.materials.videos![0]!.status).toBe('COMPLETED');
    expect(item.materials.videos![1]).toMatchObject({ comment: 'kept', feedback: 4.5 }); // untouched rows kept as Tala has them
    expect(item.userId).toBe('tala-user-1');
    expect(item.progress).toBe('2/5');
    expect(item).not.toHaveProperty('createdAt'); // server metadata is not echoed back
    expect(Object.keys(item.materials)).toEqual(['videos', 'cards', 'quizzes', 'epubs', 'pdfs']);
  });

  it('never lets completion go backwards', async () => {
    const { client } = fakeClient({ snapshot: snapshot({ progress: '4/5' }) });
    expect((await submitProgress(ctxOf(client), 'A1', ['v1'])).progress).toBe('4/5');
  });

  it('completes the course once everything is done', async () => {
    const a = assignment({ totalMaterial: '2' });
    const { client } = fakeClient({ assignments: [a], snapshot: snapshot({ progress: '1/2' }) });
    expect(await submitProgress(ctxOf(client), 'A1', ['v1'])).toMatchObject({ progress: '2/2', status: 'COMPLETED' });
  });

  it('builds a material without a stored row from Tala metadata', async () => {
    const { client, posted } = fakeClient();
    await submitProgress(ctxOf(client), 'A1', ['p1']);
    const pdfs = lastItem(posted).materials.pdfs!;
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]).toMatchObject({ pdfId: 'p1', status: 'COMPLETED', pdfName: 'Manual' });
  });

  it('stores video feedback with a cleaned comment, "N/A" when empty', async () => {
    const { client, posted } = fakeClient();
    await submitProgress(ctxOf(client), 'A1', ['v1'], { v1: { rating: 4.5, comment: '  great\u0007  ' } });
    expect(lastItem(posted).materials.videos![0]).toMatchObject({ feedback: 4.5, comment: 'great' });
    const b = fakeClient();
    await submitProgress(ctxOf(b.client), 'A1', ['v1'], { v1: { rating: 5 } });
    expect(lastItem(b.posted).materials.videos![0]!.comment).toBe('N/A');
  });

  it('refuses unknown, hidden, quiz and bad-feedback requests before anything is written', async () => {
    const { client, posted } = fakeClient();
    const c = ctxOf(client);
    expect(await codeOf(submitProgress(c, 'A1', ['q1']))).toBe('unsupported_material');
    expect(await codeOf(submitProgress(c, 'A1', ['nope']))).toBe('not_found');
    expect(await codeOf(submitProgress(c, 'A1', ['e1']))).toBe('not_found'); // epub: hidden
    expect(await codeOf(submitProgress(c, 'A1', ['v1', 'q1']))).toBe('unsupported_material');
    expect(await codeOf(submitProgress(c, 'NOT-MINE', ['v1']))).toBe('not_found');
    expect(await codeOf(submitProgress(c, 'A1', ['p1'], { p1: { rating: 4 } }))).toBe('invalid_feedback');
    expect(await codeOf(submitProgress(c, 'A1', ['v1'], { v1: { rating: 4.3 } }))).toBe('invalid_feedback');
    expect(await codeOf(submitProgress(c, 'A1', ['v1'], { v2: { rating: 4 } }))).toBe('invalid_feedback');
    expect(posted).toEqual([]);
  });

  it('is never retried, and says unavailable or sign-in-again as Tala does', async () => {
    const down = fakeClient({ syncError: new TalaError('unavailable') });
    expect(((await fail(submitProgress(ctxOf(down.client), 'A1', ['v1']))) as TalaError).kind).toBe('unavailable');
    expect(down.posted).toHaveLength(1);
    const out = fakeClient({ syncError: new TalaError('unauthorized') });
    expect(((await fail(submitProgress(ctxOf(out.client), 'A1', ['v1']))) as TalaError).kind).toBe('unauthorized');
  });

  it('refuses a second update of the same account while one is in progress', async () => {
    const a = fakeClient();
    const slow = fakeClient();
    const original = slow.client.progress;
    let release: () => void = () => {};
    slow.client.progress = async (...args: Parameters<typeof original>) => {
      await new Promise<void>((r) => (release = r));
      return original(...args);
    };
    const first = submitProgress(ctxOf(slow.client), 'A1', ['v1']);
    await new Promise((r) => setTimeout(r, 0));
    expect(await codeOf(submitProgress(ctxOf(a.client), 'A1', ['v1']))).toBe('progress_busy');
    expect(a.posted).toEqual([]);
    release();
    await first;
    await submitProgress(ctxOf(a.client), 'A1', ['v1']); // the lock is released afterwards
    expect(a.posted).toHaveLength(1);
  });
});

describe('quiz attempts', () => {
  const answers = (a: string, b: string) => [{ ref: '0.0', value: a }, { ref: '0.1', value: b }];

  it('scores on the device and writes the result into the snapshot, keeping the other quiz', async () => {
    const snap = snapshot({ progress: '1/5' });
    (snap.materials as Record<string, unknown[]>).quizzes = [{ quizId: 'q-other', status: 'COMPLETED', correct: 4 }];
    const { client, posted } = fakeClient({ snapshot: snap });
    const out = await submitQuiz(ctxOf(client), 'A1', 'q1', null, answers('1', '0'));
    expect(out).toMatchObject({ correct: 1, wrong: 1, total: 2, average: 50, passed: false, progress: '3/5' }); // the other video, the other quiz and this quiz
    expect(JSON.stringify(out)).not.toMatch(/orange|call/); // totals only: no answers back
    const rows = lastItem(posted).materials.quizzes!;
    expect(rows.map((r) => r.quizId)).toEqual(['q-other', 'q1']);
    expect(rows[1]).toMatchObject({ status: 'COMPLETED', correct: 1, wrong: 1, average: 50, remarks: 'FAILED' });
  });

  it('replaces a stored attempt on a retake and passes a perfect score', async () => {
    const snap = snapshot();
    (snap.materials as Record<string, unknown[]>).quizzes = [{ quizId: 'q1', status: 'COMPLETED', correct: 0, wrong: 2 }];
    const { client, posted } = fakeClient({ snapshot: snap });
    const out = await submitQuiz(ctxOf(client), 'A1', 'q1', null, answers('1', '3'));
    expect(out).toMatchObject({ correct: 2, wrong: 0, average: 100, passed: true });
    expect(lastItem(posted).materials.quizzes).toHaveLength(1);
  });

  it('refuses a stale version, a non-quiz and a quiz it cannot score, writing nothing', async () => {
    const { client, posted } = fakeClient();
    const c = ctxOf(client);
    expect(await codeOf(submitQuiz(c, 'A1', 'q1', 'stale', answers('1', '3')))).toBe('quiz_changed');
    expect(await codeOf(submitQuiz(c, 'A1', 'v1', null, answers('1', '3')))).toBe('not_found');
    expect(await codeOf(submitQuiz(c, 'A1', 'q1', null, [{ ref: '0.0', value: '1' }]))).toBe('incomplete_answers');
    const bad = quizDoc();
    ((bad.arraySection as { data: { answer: string }[] }[])[0]!).data[0]!.answer = '4';
    const b = fakeClient({ quiz: bad });
    expect(await codeOf(submitQuiz(ctxOf(b.client), 'A1', 'q1', null, answers('1', '3')))).toBe('unsupported_quiz');
    expect(posted).toEqual([]);
    expect(b.posted).toEqual([]);
  });
});

describe('flashcard ratings', () => {
  const rate = [{ index: 1, rating: 'hard' }, { index: 0, rating: 'easy' }];

  it('writes a complete set as Tala\'s row and keeps the other rows', async () => {
    const { client, posted } = fakeClient();
    const out = await submitFlashcards(ctxOf(client), 'A1', 'c1', null, rate);
    expect(out).toMatchObject({ easy: 1, medium: 0, hard: 1, progress: '2/5' });
    const row = lastItem(posted).materials.cards![0]!;
    expect(row).toMatchObject({ status: 'COMPLETED', notseen: 0, easy: 1, medium: 0, hard: 1 });
    expect((row.data as { result: string }[]).map((r) => r.result)).toEqual(['EASY', 'HARD']);
    expect(lastItem(posted).materials.videos![1]!.comment).toBe('kept');
  });

  it('refuses an incomplete set, a stale version and a non-deck, writing nothing', async () => {
    const { client, posted } = fakeClient();
    const c = ctxOf(client);
    expect(await codeOf(submitFlashcards(c, 'A1', 'c1', null, [{ index: 0, rating: 'easy' }]))).toBe('incomplete_ratings');
    expect(await codeOf(submitFlashcards(c, 'A1', 'c1', 'stale', rate))).toBe('deck_changed');
    expect(await codeOf(submitFlashcards(c, 'A1', 'v1', null, rate))).toBe('not_found');
    expect(posted).toEqual([]);
  });
});
