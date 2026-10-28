import { TalaError } from '../client';
import { TalaProblem } from '../problem';
import { courseDetail, courses, flashcardsView, joinCourse, material, quizView } from '../reads';
import { assignment, ctxOf, fakeClient, snapshot } from '../testing/fixtures';

const codeOf = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as TalaProblem).code;

describe('reads', () => {
  it('lists the courses', async () => {
    const { client } = fakeClient({ assignments: [assignment(), { ...assignment(), assignId: 'A2' }] });
    expect((await courses(ctxOf(client))).map((c) => c.id)).toEqual(['A1', 'A2']);
  });

  it('shows a course with its materials, stored progress and whether progress can be submitted', async () => {
    const snap = snapshot();
    (snap.materials as Record<string, unknown[]>).videos = [{ videoId: 'v1', progress: '100', status: 'done', feedback: 4.5 }];
    const { client } = fakeClient({ snapshot: snap });
    const d = await courseDetail(ctxOf(client), 'A1');
    expect(d).toMatchObject({ id: 'A1', progress_submission: true, hidden_materials: 2, sequential: false });
    expect(d.materials[0]).toMatchObject({ id: 'v1', progress: '100', status: 'done', stats: { rating: 4.5 } });
    expect(d.materials[1]).toMatchObject({ id: 'p1', progress: null, status: null, stats: null });
    expect((await courseDetail(ctxOf(client, false), 'A1')).progress_submission).toBe(false);
  });

  it('reads a sequential course, and still shows the course when the stored progress is unavailable', async () => {
    const seq = assignment({ sequential: ' Yes ' });
    const f = fakeClient({ assignments: [seq] });
    f.client.progress = async () => {
      throw new TalaError('unavailable');
    };
    const d = await courseDetail(ctxOf(f.client), 'A1');
    expect(d.sequential).toBe(true);
    expect(d.materials[0]!.progress).toBeNull();
  });

  it('does not find another learner\'s course', async () => {
    expect(await codeOf(courseDetail(ctxOf(fakeClient().client), 'NOT-MINE'))).toBe('not_found');
  });

  it('gives a video or pdf with only https links, and refuses quizzes and cards', async () => {
    const { client } = fakeClient();
    const c = ctxOf(client);
    expect(await material(c, 'A1', 'v1')).toMatchObject({
      type: 'video',
      name: 'Intro video',
      file_url: 'https://files.example.com/v.mp4',
      thumbnail_url: null, // http: is not passed on
    });
    expect(await material(c, 'A1', 'p1')).toMatchObject({ type: 'pdf', file_url: null }); // javascript: is not passed on
    expect(await codeOf(material(c, 'A1', 'q1'))).toBe('unsupported_material');
    expect(await codeOf(material(c, 'A1', 'zzz'))).toBe('not_found');
  });

  it('delivers quiz questions without answers and refuses what is not a quiz in this course', async () => {
    const { client, calls } = fakeClient();
    const c = ctxOf(client);
    const view = await quizView(c, 'A1', 'q1');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('answer');
    expect(await codeOf(quizView(c, 'A1', 'v1'))).toBe('not_found');
    expect(await codeOf(quizView(ctxOf(client, false), 'A1', 'q1'))).toBe('feature_disabled');
    expect(calls.filter((x) => x === 'quiz')).toHaveLength(1);
  });

  it('delivers a deck and resumes the ratings Tala holds', async () => {
    const snap = snapshot();
    (snap.materials as Record<string, unknown[]>).cards = [{ cardId: 'c1', data: [{ result: 'HARD' }, { result: 'NOT SEEN' }] }];
    const { client, posted } = fakeClient({ snapshot: snap });
    const view = await flashcardsView(ctxOf(client), 'A1', 'c1');
    expect(view.cards.map((c) => c.rating)).toEqual(['hard', null]);
    expect(posted).toEqual([]);
    expect(await codeOf(flashcardsView(ctxOf(client, false), 'A1', 'c1'))).toBe('feature_disabled');
    expect(await codeOf(flashcardsView(ctxOf(client), 'A1', 'v1'))).toBe('not_found');
  });

  it('applies to join a course by code and says only that it was requested', async () => {
    const { client, calls } = fakeClient();
    expect(await joinCourse(ctxOf(client), 'ABC-123')).toEqual({ status: 'requested' });
    expect(calls).toContain('apply:ABC-123');
  });

  it('is closed while writes are off, and a wrong code is one plain message', async () => {
    const f = fakeClient();
    expect(await codeOf(joinCourse(ctxOf(f.client, false), 'ABC'))).toBe('feature_disabled');
    expect(f.calls).toEqual([]);
    expect(await codeOf(joinCourse(ctxOf(f.client), 'BAD'))).toBe('course_code_rejected');
  });
});
