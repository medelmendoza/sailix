import { TalaProblem } from '../problem';
import { parseQuiz } from '../quiz';
import { quizDoc } from '../testing/fixtures';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as TalaProblem).code;
  }
  return null;
};
const good = [
  { ref: '0.0', value: '1' },
  { ref: '0.1', value: '3' },
];

describe('quiz', () => {
  it('delivers questions and choices, never an answer', () => {
    const view = parseQuiz(quizDoc()).publicView();
    expect(view.sections[0]?.questions.map((q) => q.ref)).toEqual(['0.0', '0.1']);
    expect(view.sections[0]?.questions[0]?.choices).toEqual(['blue', 'orange', 'green', 'black']);
    expect(JSON.stringify(view).toLowerCase()).not.toContain('answer');
    expect(view.version).toBeTruthy();
  });

  it('scores single choice and keeps the totals', () => {
    const score = parseQuiz(quizDoc()).score([
      { ref: '0.0', value: '1' },
      { ref: '0.1', value: '0' },
    ]);
    expect(score).toMatchObject({ correct: 1, wrong: 1, total: 2, average: 50, passed: false });
    expect(score.byRef['0.0']).toEqual({ user: 'orange', correct: true });
    expect(score.byRef['0.1']).toEqual({ user: 'run', correct: false });
  });

  it('passes a perfect score at the pass mark', () => {
    expect(parseQuiz(quizDoc()).score(good)).toMatchObject({ average: 100, passed: true });
  });

  it('compares checkbox answers as sets and text answers ignoring case and spaces', () => {
    const doc = quizDoc({
      arraySection: [
        {
          data: [
            { questionType: 'checkbox', question: 'Pick two', answer: '0:2', choices: 'a:b:c:d', required: 'false' },
            { questionType: 'shortAnswer', question: 'Name it', answer: 'Life  Buoy' },
          ],
        },
      ],
    });
    const q = parseQuiz(doc);
    const ok = q.score([
      { ref: '0.0', value: [2, '0', 2] },
      { ref: '0.1', value: ' life buoy ' },
    ]);
    expect(ok).toMatchObject({ correct: 2, passed: true });
    expect(ok.byRef['0.0']?.user).toBe('[a, c]');
    expect(q.score([{ ref: '0.0', value: ['0'] }, { ref: '0.1', value: 'x' }]).correct).toBe(0);
  });

  it('refuses incomplete, duplicate, unknown and malformed answers', () => {
    const q = parseQuiz(quizDoc());
    expect(code(() => q.score([{ ref: '0.0', value: '1' }]))).toBe('incomplete_answers');
    expect(code(() => q.score([{ ref: '0.0', value: '1' }, { ref: '0.1', value: '9' }]))).toBe('invalid_answers');
    expect(code(() => q.score([{ ref: '0.0', value: '1' }, { ref: '0.0', value: '1' }]))).toBe('invalid_answers');
    expect(code(() => q.score([...good, { ref: '9.9', value: '1' }]))).toBe('invalid_answers');
    expect(code(() => q.score([{ ref: '0.0', value: '1' }, { ref: '0.1', value: null }]))).toBe('invalid_answers');
  });

  it('refuses a quiz it cannot score with certainty', () => {
    const doc = quizDoc();
    ((doc.arraySection as { data: { answer: string }[] }[])[0]!).data[0]!.answer = '4'; // 1-based style key
    expect(code(() => parseQuiz(doc))).toBe('unsupported_quiz');
    expect(code(() => parseQuiz({ quizId: 'q' }))).toBe('unsupported_quiz');
  });

  it('writes the row Tala itself stores, with the result of each question', () => {
    const q = parseQuiz(quizDoc());
    const row = q.syncRow(q.score([{ ref: '0.0', value: '1' }, { ref: '0.1', value: '0' }]));
    expect(row).toMatchObject({ quizId: 'q1', status: 'COMPLETED', correct: 1, wrong: 1, average: 50, remarks: 'FAILED', quizPercentage: '70' });
    const data = (row.sections as { data: { result: string; userAnswer: string }[] }[])[0]!.data;
    expect(data.map((d) => d.result)).toEqual(['CORRECT', 'WRONG']);
    expect(data.map((d) => d.userAnswer)).toEqual(['orange', 'run']);
  });

  it('changes its version when the questions change', () => {
    const a = parseQuiz(quizDoc()).version();
    const doc = quizDoc();
    ((doc.arraySection as { data: { question: string }[] }[])[0]!).data[0]!.question = 'Changed?';
    expect(parseQuiz(doc).version()).not.toBe(a);
    expect(parseQuiz(quizDoc()).version()).toBe(a);
  });
});
