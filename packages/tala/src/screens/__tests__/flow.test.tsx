import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { talaModule } from '../../index';
import { snapshot } from '../../direct/testing/fixtures';
import { fakeTala, hostOf, paths, renderTala, stopFakeTala } from '../../testing/render';

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const press = async (name: string | RegExp, role = 'button') =>
  fireEvent.press(await screen.findByRole(role as 'button', { name }));

/** The app opens on the Dashboard: go to My Courses and return the first course card. */
const showCourses = async () => {
  await fireEvent.press(await screen.findByLabelText(/^My Courses/));
  return screen.findByRole('button', { name: /Safety at sea/ });
};

async function signIn(user = 'ann', pw = 'pw') {
  await fireEvent.changeText(await screen.findByLabelText('Lodestar username or email'), user);
  await fireEvent.changeText(screen.getByLabelText('Lodestar password'), pw);
  await press('Sign in');
}

let alert: jest.SpyInstance;
beforeEach(() => {
  store().clear();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => {
  stopFakeTala();
  alert.mockRestore();
  await AsyncStorage.clear();
});

describe('signing in', () => {
  it('asks for a Tala account, then shows the courses of its team', async () => {
    fakeTala();
    await renderTala();
    await signIn();
    expect(await showCourses()).toBeTruthy();
  });

  it('says so when Tala does not accept the credentials, and clears the password', async () => {
    fakeTala({ 'POST /api/v1/login': { status: 401 } });
    await renderTala();
    await signIn('ann', 'wrong');
    expect(await screen.findByText('Lodestar did not accept those credentials.')).toBeTruthy();
    expect(screen.getByLabelText('Lodestar password').props.value).toBe('');
    expect(store().size).toBe(0);
  });

  it('starts over from the saved session, without a crash, when the host is replaced while it is open', async () => {
    fakeTala();
    const host = hostOf();
    const view = await renderTala(host);
    await signIn();
    await showCourses();
    await view.rerender(<talaModule.Root host={{ ...host }} />);
    expect(await showCourses()).toBeTruthy();
  });

  it('keeps the session across a restart', async () => {
    fakeTala();
    const first = await renderTala();
    await signIn();
    await showCourses();
    await first.unmount();
    await renderTala();
    expect(await showCourses()).toBeTruthy();
    expect(screen.queryByLabelText('Lodestar password')).toBeNull();
  });

  it('lets only the organization\'s own team in, and keeps nothing otherwise', async () => {
    fakeTala();
    await renderTala(hostOf({ config: { talaBaseUrl: 'https://tala.example.test', progressWrites: true, teamId: 'OTHER' } }));
    await signIn();
    expect(await screen.findByText(/does not belong to your organization's team/)).toBeTruthy();
    expect(store().size).toBe(0);
  });

  it('asks which team when the account has several', async () => {
    fakeTala({
      [`GET ${paths.U}/teams`]: { status: 200, data: [{ teamId: 'TEAM-1', teamName: 'Deck crew' }, { teamId: 'TEAM-2', teamName: 'Engine crew' }] },
    });
    await renderTala();
    await signIn();
    await press('Engine crew');
    expect(await screen.findByLabelText(/^Dashboard/)).toBeTruthy(); // the chosen team's app opened
  });

  it('goes back to sign-in, saying why, when Tala stops accepting the token', async () => {
    const tala = fakeTala();
    await renderTala();
    await signIn();
    await showCourses();
    tala.set(`GET ${paths.T}/courses`, { status: 401 });
    await act(async () => {
      await fireEvent.press(await screen.findByRole('button', { name: /My Courses/ }));
    });
    // pull to refresh equivalent: a fresh mount of the list
    await renderTala();
    expect(await screen.findByText(/session ended/)).toBeTruthy();
    expect(store().size).toBe(0);
  });
});

describe('the host', () => {
  it('can be left through the account menu', async () => {
    fakeTala();
    const host = hostOf();
    await renderTala(host);
    await signIn();
    await press('Account menu');
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Sign out', 'Back', 'Cancel']);
    buttons.find((b) => b.text === 'Back')!.onPress!();
    expect(host.onExit).toHaveBeenCalledTimes(1);
  });

  it('signs out, wiping the tokens and what was saved for offline use', async () => {
    fakeTala();
    await renderTala();
    await signIn();
    await showCourses();
    await waitFor(async () => expect((await AsyncStorage.getAllKeys()).some((k) => k.startsWith('tala:'))).toBe(true));
    await press('Account menu');
    const out = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find((b) => b.text === 'Sign out')!;
    await act(async () => out.onPress!());
    expect(await screen.findByLabelText('Lodestar password')).toBeTruthy();
    expect(store().size).toBe(0);
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('tala:'))).toEqual([]);
  });

  it('keeps the data of two scopes apart', async () => {
    fakeTala();
    await renderTala(hostOf({ scope: 'org:1' }));
    await signIn();
    await showCourses();
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('tala:'));
    expect(keys.every((k) => k.includes('org-1'))).toBe(true);
    expect(store().has('tala.org_1.session')).toBe(true);
    expect(store().has('tala.org_2.session')).toBe(false);
  });
});

describe('studying', () => {
  async function openCourse() {
    await renderTala();
    await signIn();
    await showCourses();
    await press(/Safety at sea/);
  }

  it('shows the materials of a course', async () => {
    fakeTala();
    await openCourse();
    expect(await screen.findByText('Intro video')).toBeTruthy();
    expect(screen.getAllByText('Quiz').length).toBeGreaterThan(0);
  });

  it('takes a quiz: scored on the device, the result written to Tala, totals only shown', async () => {
    const tala = fakeTala();
    await openCourse();
    await press(/^Take quiz/);
    await screen.findByText('1. Which colour is a lifebuoy?');
    await press('orange', 'radio');
    await press('call', 'radio');
    await press('Submit answers');
    const submit = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find((b) => b.text === 'Submit')!;
    await act(async () => submit.onPress!());
    expect(await screen.findByText('Passed')).toBeTruthy();
    expect(screen.getByText('2 correct, 0 wrong, 2 questions')).toBeTruthy();
    const sent = tala.posts(`${paths.T}/courses/sync`)[0]!.body as { courseList: { materials: { quizzes: { quizId: string; remarks: string }[] } }[] };
    expect(sent.courseList[0]!.materials.quizzes[0]).toMatchObject({ quizId: 'q1', remarks: 'PASSED' });
  });

  it('studies flashcards and writes the set once every card is rated', async () => {
    const tala = fakeTala();
    await openCourse();
    await press(/^Study flashcards/);
    for (const rating of ['Easy', 'Hard']) {
      await press('Show answer');
      await press(rating);
    }
    expect(await screen.findByText('All cards rated')).toBeTruthy();
    await waitFor(() => expect(tala.posts(`${paths.T}/courses/sync`)).toHaveLength(1));
    const row = (tala.posts(`${paths.T}/courses/sync`)[0]!.body as { courseList: { materials: { cards: { easy: number; hard: number }[] } }[] }).courseList[0]!.materials.cards[0];
    expect(row).toMatchObject({ easy: 1, hard: 1 });
  });
});

describe('the dashboard', () => {
  it('opens first, with My Stats and Due Dates for each course, and opens nothing', async () => {
    fakeTala();
    await renderTala();
    await signIn();
    expect(await screen.findByText('My Stats')).toBeTruthy();
    expect(screen.getByText('Due Dates')).toBeTruthy();
    expect(screen.getAllByText('Safety at sea').length).toBe(2); // once in each card
    expect(screen.getByText(/due 2026-12-31/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Safety at sea/ })).toBeNull(); // read-only
  });
});

describe('a course in Stats', () => {
  it('shows what was recorded for it and offers nothing to watch, take or study', async () => {
    const snap = snapshot();
    (snap.materials as Record<string, unknown[]>).quizzes = [
      { quizId: 'q1', status: 'COMPLETED', correct: 1, wrong: 1, average: 50, remarks: 'FAILED' },
    ];
    (snap.materials as Record<string, unknown[]>).cards = [
      { cardId: 'c1', status: 'COMPLETED', easy: 1, medium: 0, hard: 1, notseen: 0 },
    ];
    (snap.materials as Record<string, unknown[]>).videos = [{ videoId: 'v1', status: 'COMPLETED', feedback: 4.5 }];
    fakeTala({ [`GET ${paths.T}/courses/C1/sync/A1/data`]: { status: 200, data: snap } });
    await renderTala();
    await signIn();
    await fireEvent.press(await screen.findByLabelText(/^Stats/));
    await press(/Safety at sea/);
    expect(await screen.findByText('Intro video')).toBeTruthy();
    expect(screen.getByText('Your rating: 4.5 of 5')).toBeTruthy();
    expect(screen.getByText('Score 50% · Not passed (1 correct, 1 wrong)')).toBeTruthy();
    expect(screen.getByText('Easy 1 · Medium 0 · Hard 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Take quiz|^Retake|^Study flashcards|Download|Continue/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Intro video|Quiz|Knots/ })).toBeNull();
  });
});

describe('joining a course', () => {
  it('says the request was sent, never that the course was joined', async () => {
    const tala = fakeTala();
    await renderTala();
    await signIn();
    await press(/Join a course/, 'button');
    await fireEvent.changeText(await screen.findByLabelText('Course code'), 'ABC-123');
    await press('Request to join');
    expect(await screen.findByText(/Request sent/)).toBeTruthy();
    expect(tala.posts(`${paths.T}/courses/apply`)[0]!.body).toEqual({ courseCode: 'ABC-123' });
  });

  it('shows a rejected code against the field', async () => {
    fakeTala({ [`POST ${paths.T}/courses/apply`]: { status: 400 } });
    await renderTala();
    await signIn();
    await press(/Join a course/, 'button');
    await fireEvent.changeText(await screen.findByLabelText('Course code'), 'NOPE');
    await press('Request to join');
    expect(await screen.findByText('That course code was not accepted.')).toBeTruthy();
  });
});

describe('offline', () => {
  it('shows the saved courses when Tala cannot be reached', async () => {
    const tala = fakeTala();
    const first = await renderTala();
    await signIn();
    await showCourses();
    await first.unmount();
    tala.set(`GET ${paths.T}/courses`, { status: 503 });
    await renderTala();
    expect(await showCourses()).toBeTruthy();
    expect(await screen.findByText(/copy saved on this device/)).toBeTruthy();
  });
});
