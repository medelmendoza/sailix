import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const course = {
  id: 'A1',
  name: 'Safety at sea',
  description: null,
  thumbnail_url: null,
  date_from: null,
  date_to: null,
  status: 'ongoing',
  progress: '50',
  total_materials: 1,
};
const quizMaterial = (viewable: boolean, status: string | null = null) => ({
  id: 'q1',
  type: 'quiz',
  name: 'Final quiz',
  description: null,
  thumbnail_url: null,
  viewable,
  progress: null,
  status,
});
const detail = (viewable = true, status: string | null = null) => ({
  ...course,
  hidden_materials: 0,
  progress_submission: viewable,
  materials: [quizMaterial(viewable, status)],
});
const quiz = {
  id: 'q1',
  name: 'Final quiz',
  description: 'Be careful',
  version: 'v-abc',
  sections: [
    {
      id: 's1',
      title: 'Part 1',
      description: null,
      questions: [
        {
          ref: '0.0',
          type: 'single',
          text: 'Which colour is a lifebuoy?',
          choices: ['blue', 'orange', 'green'],
          required: true,
          media_type: null,
          media_url: null,
        },
        {
          ref: '0.1',
          type: 'multiple',
          text: 'Pick all safe actions',
          choices: ['run', 'call', 'wait'],
          required: true,
          media_type: null,
          media_url: null,
        },
        {
          ref: '0.2',
          type: 'text',
          text: 'Name the device',
          choices: [],
          required: true,
          media_type: null,
          media_url: null,
        },
      ],
    },
  ],
};
const result = (passed = true) => ({
  progress: '1/1',
  status: 'COMPLETED',
  correct: passed ? 3 : 1,
  wrong: passed ? 0 : 2,
  total: 3,
  average: passed ? 100 : 33.33,
  passed,
});

beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

async function openQuiz(routes: Record<string, unknown> = {}, viewable = true) {
  const api = mockApi({
    'GET /modules/tala/courses': { data: { data: [course] } },
    'GET /modules/tala/courses/A1': { data: { data: detail(viewable) } },
    'GET /modules/tala/courses/A1/quizzes/q1': { data: { data: quiz } },
    ...routes,
  } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
  return api;
}

async function answerAll() {
  await fireEvent.press(await screen.findByRole('radio', { name: 'orange' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'run' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'call' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'run' })); // untick again
  await fireEvent.changeText(screen.getByLabelText('Answer to question 3'), 'Life jacket');
}

const confirm = async () => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => {
    buttons.find((b) => b.text === 'Submit')!.onPress!();
  });
};

describe('taking a quiz', () => {
  it('is offered only when the server says it can be taken', async () => {
    await openQuiz({}, false);
    expect(await screen.findByText(/Quizzes are not available in this version/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take quiz' })).toBeNull();
  });

  it('shows the questions, needs every answer, and sends answers only (never a score)', async () => {
    const api = await openQuiz({
      'POST /modules/tala/courses/A1/quizzes/q1/attempts': { data: { data: result() } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));

    expect(await screen.findByText('1. Which colour is a lifebuoy?')).toBeTruthy();
    expect(screen.getByText('Answer every question to submit.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Submit answers' }).props.accessibilityState?.disabled,
    ).toBe(true);

    await answerAll();
    expect(screen.queryByText('Answer every question to submit.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }));
    expect(api.callsTo('POST /modules/tala/courses/A1/quizzes/q1/attempts')).toHaveLength(0); // asks first
    await confirm();

    expect(await screen.findByText('Passed')).toBeTruthy();
    expect(screen.getByText('You got 100%')).toBeTruthy();
    expect(screen.getByText('3 correct, 0 wrong, 3 questions')).toBeTruthy();
    expect(api.callsTo('POST /modules/tala/courses/A1/quizzes/q1/attempts')[0]?.body).toEqual({
      version: 'v-abc',
      answers: [
        { ref: '0.0', value: '1' },
        { ref: '0.1', value: ['1'] },
        { ref: '0.2', value: 'Life jacket' },
      ],
    });
  });

  it('shows a failing result without revealing which questions were wrong, and can be retaken', async () => {
    const api = await openQuiz({
      'POST /modules/tala/courses/A1/quizzes/q1/attempts': { data: { data: result(false) } },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));
    await screen.findByText('1. Which colour is a lifebuoy?');
    await answerAll();
    await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }));
    await confirm();

    expect(await screen.findByText('Not passed')).toBeTruthy();
    expect(screen.getByText('1 correct, 2 wrong, 3 questions')).toBeTruthy();
    expect(screen.queryByText(/Which colour/)).toBeNull(); // no per-question review

    await fireEvent.press(screen.getByRole('button', { name: 'Retake quiz' }));
    expect(await screen.findByText('1. Which colour is a lifebuoy?')).toBeTruthy();
    expect(api.callsTo('GET /modules/tala/courses/A1/quizzes/q1').length).toBeGreaterThanOrEqual(2); // fetched fresh
    expect(screen.getByRole('radio', { name: 'orange' }).props.accessibilityState?.checked).toBe(
      false,
    ); // answers cleared
  });

  it.each([
    ['incomplete_answers', 422, /answer every question/i],
    ['invalid_answers', 422, /could not be accepted/],
    ['module_unavailable', 503, /not reachable right now/],
    ['relink_required', 409, /link expired/i],
  ])('explains %s and keeps the answers so nothing is retyped', async (code, status, text) => {
    await openQuiz({ 'POST /modules/tala/courses/A1/quizzes/q1/attempts': problem(status, code) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));
    await screen.findByText('1. Which colour is a lifebuoy?');
    await answerAll();
    await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }));
    await confirm();

    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'orange' }).props.accessibilityState?.checked).toBe(
      true,
    );
  });

  it('a quiz that changed meanwhile is reloaded with a message', async () => {
    let gets = 0;
    const api = await openQuiz({
      'GET /modules/tala/courses/A1/quizzes/q1': () => ({
        data: { data: { ...quiz, version: `v-${++gets}` } },
      }),
      'POST /modules/tala/courses/A1/quizzes/q1/attempts': problem(409, 'quiz_changed'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));
    await screen.findByText('1. Which colour is a lifebuoy?');
    await answerAll();
    await fireEvent.press(screen.getByRole('button', { name: 'Submit answers' }));
    await confirm();

    expect(await screen.findByText(/quiz was updated/i)).toBeTruthy();
    await waitFor(() => expect(gets).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole('radio', { name: 'orange' }).props.accessibilityState?.checked).toBe(
      false,
    );
    expect(api.callsTo('POST /modules/tala/courses/A1/quizzes/q1/attempts')[0]?.body).toMatchObject(
      { version: 'v-1' },
    );
  });

  it('needs a connection: offline is an honest message with retry, and nothing about a quiz is stored', async () => {
    await openQuiz({ 'GET /modules/tala/courses/A1/quizzes/q1': { networkError: true } });
    await fireEvent.press(await screen.findByRole('button', { name: 'Take quiz' }));
    expect(await screen.findByText(/No connection/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect((await AsyncStorage.getAllKeys()).filter((k) => /quiz/i.test(k))).toEqual([]);
  });

  it('offers a retake for a quiz that is already completed', async () => {
    mockApi({
      'GET /modules/tala/courses': { data: { data: [course] } },
      'GET /modules/tala/courses/A1': { data: { data: detail(true, 'COMPLETED') } },
    });
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    expect(await screen.findByRole('button', { name: 'Retake quiz' })).toBeTruthy();
  });
});
