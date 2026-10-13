import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import {
  pendingCompletions,
  queueCompletion,
  queueFlashcards,
  syncOutbox,
} from '../tala/offline/outbox';
import { currentScope } from '../tala/offline/paths';
import { setCachedDeck } from '../tala/offline/store';

const course = {
  id: 'A1',
  name: 'Seamanship',
  description: null,
  thumbnail_url: null,
  date_from: null,
  date_to: null,
  status: 'ongoing',
  progress: '0/4',
  total_materials: 1,
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
};
const material = (viewable: boolean, status: string | null = null) => ({
  id: 'c1',
  type: 'flashcards',
  name: 'Knots',
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
  materials: [material(viewable, status)],
});
const card = (index: number, over = {}) => ({
  index,
  question: `Question ${index}`,
  question_media: null,
  answer: `Answer ${index}`,
  answer_media: null,
  rating: null,
  ...over,
});
const deck = (cards = [card(0), card(1), card(2)]) => ({
  id: 'c1',
  name: 'Knots',
  description: null,
  version: 'dv1',
  cards,
});
const RESULT = { progress: '1/1', status: 'COMPLETED', easy: 1, medium: 1, hard: 1 };
const POST = 'POST /modules/tala/courses/A1/flashcards/c1/ratings';

beforeEach(() => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

async function openDeck(
  routes: Record<string, unknown> = {},
  viewable = true,
  status: string | null = null,
  before?: () => Promise<void>,
) {
  const api = mockApi({
    'GET /modules/tala/courses': { data: { data: [course] } },
    'GET /modules/tala/courses/A1': { data: { data: detail(viewable, status) } },
    'GET /modules/tala/courses/A1/flashcards/c1': { data: { data: deck() } },
    ...routes,
  } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await before?.();
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /Seamanship/ }));
  return api;
}

/** Studies every card shown, rating by the number in its question (so the random order does not matter). */
async function rateShown(by: (n: number) => 'Easy' | 'Medium' | 'Hard', limit = Infinity) {
  for (let done = 0; done < limit; done++) {
    const shown = screen.queryByText(/^Question \d$/);
    if (!shown) return;
    const n = Number(String(shown.props.children).replace('Question ', ''));
    await fireEvent.press(screen.getByRole('button', { name: 'Show answer' }));
    expect(await screen.findByText(`Answer ${n}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: by(n) }));
  }
}

describe('flashcard study', () => {
  it('is offered only when the server says it can be studied', async () => {
    await openDeck({}, false);
    expect(await screen.findByText(/Flashcards are not available in this version/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Study flashcards' })).toBeNull();
  });

  it('shows a card, reveals the answer on request, and rates it', async () => {
    await openDeck();
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));

    expect(await screen.findByText(/Card 1 of 3 · Rated 0 of 3/)).toBeTruthy();
    expect(screen.queryByText(/^Answer \d$/)).toBeNull(); // not revealed yet
    expect(screen.queryByRole('button', { name: 'Easy' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show answer' }));
    expect(await screen.findByText(/^Answer \d$/)).toBeTruthy();
    for (const r of ['Easy', 'Medium', 'Hard'])
      expect(screen.getByRole('button', { name: r })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Medium' }));
    expect(await screen.findByText(/Card 2 of 3 · Rated 1 of 3/)).toBeTruthy();
  });

  it('sends nothing until every card is rated, then sends the complete set once', async () => {
    const api = await openDeck({ [POST]: { data: { data: RESULT } } });
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    await screen.findByText(/Card 1 of 3/);

    // rate two of the three cards: nothing is sent yet
    await rateShown((n) => (n === 0 ? 'Easy' : n === 1 ? 'Medium' : 'Hard'), 2);
    expect(await screen.findByText(/Rated 2 of 3/)).toBeTruthy();
    expect(api.callsTo(POST)).toHaveLength(0);

    await rateShown((n) => (n === 0 ? 'Easy' : n === 1 ? 'Medium' : 'Hard'));

    expect(await screen.findByText('All cards rated')).toBeTruthy();
    expect(screen.getByText('Easy 1 · Medium 1 · Hard 1')).toBeTruthy();
    await waitFor(() => expect(api.callsTo(POST)).toHaveLength(1));
    const body = api.callsTo(POST)[0]!.body as {
      version: string;
      ratings: { index: number; rating: string }[];
    };
    expect(body.version).toBe('dv1');
    expect(body.ratings).toHaveLength(3);
    expect(Object.keys(body)).toEqual(['version', 'ratings']); // ratings only: no counts, status or card text
    expect(new Set(body.ratings.map((r) => r.index))).toEqual(new Set([0, 1, 2]));
  });

  it('keeps the finished set on the device while offline and sends it when back online', async () => {
    const api = await openDeck({ [POST]: { data: { data: RESULT } } });
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: false } as never);
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    await screen.findByText(/Card 1 of 3/);
    await rateShown(() => 'Hard');

    expect(await screen.findByText('All cards rated')).toBeTruthy();
    expect(api.callsTo(POST)).toHaveLength(0);
    const queued = await pendingCompletions();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ kind: 'flashcards', assignId: 'A1', materialId: 'c1' });

    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
    expect(await syncOutbox()).toMatchObject({ sent: 1, kept: 0 });
    expect(api.callsTo(POST)).toHaveLength(1);
  });

  it('resumes: ratings Tala already holds are not asked again, and a restart keeps this device’s progress', async () => {
    await openDeck({
      'GET /modules/tala/courses/A1/flashcards/c1': {
        data: { data: deck([card(0, { rating: 'hard' }), card(1), card(2)]) },
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    expect(await screen.findByText(/Card 1 of 2 · Rated 1 of 3/)).toBeTruthy(); // only the two unrated cards

    await fireEvent.press(screen.getByRole('button', { name: 'Show answer' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Easy' }));
    const saved = JSON.parse(
      (await AsyncStorage.getItem(`tala:v1:${currentScope()}:ratings:A1:c1`))!,
    );
    expect(saved.version).toBe('dv1');
    expect(Object.keys(saved.ratings)).toHaveLength(2); // Tala's earlier rating plus this one, kept locally
  });

  it('practice mode starts with the hardest cards and re-sends the updated set', async () => {
    const api = await openDeck(
      {
        'GET /modules/tala/courses/A1/flashcards/c1': {
          data: {
            data: deck([
              card(0, { rating: 'easy' }),
              card(1, { rating: 'hard' }),
              card(2, { rating: 'medium' }),
            ]),
          },
        },
        [POST]: { data: { data: RESULT } },
      },
      true,
      'COMPLETED',
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Practice flashcards' }));

    expect(await screen.findByText(/Card 1 of 3 · Rated 3 of 3 · Practice/)).toBeTruthy();
    expect(screen.getByText('Question 1')).toBeTruthy(); // hard first
    await rateShown((n) => (n === 1 ? 'Easy' : 'Medium')); // the hard card is now easy

    expect(await screen.findByText('All cards rated')).toBeTruthy();
    await waitFor(() => expect(api.callsTo(POST)).toHaveLength(1));
    const ratings = (api.callsTo(POST)[0]!.body as { ratings: { index: number; rating: string }[] })
      .ratings;
    expect(ratings.find((r) => r.index === 1)?.rating).toBe('easy');
  });

  it('studies the saved copy when offline and says so', async () => {
    await openDeck(
      { 'GET /modules/tala/courses/A1/flashcards/c1': { networkError: true } },
      true,
      null,
      () =>
        setCachedDeck(currentScope(), 'A1', 'c1', {
          fetchedAt: '2026-10-13T00:00:00Z',
          deck: deck() as never,
        }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));

    expect(await screen.findByText(/studying the copy saved on this device/)).toBeTruthy();
    expect(await screen.findByText(/Card 1 of 3/)).toBeTruthy();
  });

  it('a first visit while offline is an honest error with a retry', async () => {
    await openDeck({ 'GET /modules/tala/courses/A1/flashcards/c1': { networkError: true } });
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    expect(await screen.findByText(/No connection/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('a set that changed meanwhile is dropped from the queue with a message', async () => {
    const api = await openDeck({ [POST]: problem(409, 'deck_changed') });
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    await screen.findByText(/Card 1 of 3/);
    await rateShown(() => 'Easy');

    expect(await screen.findByText(/could not be sent/)).toBeTruthy();
    expect(await pendingCompletions()).toEqual([]);
    expect(api.callsTo(POST)).toHaveLength(1);
  });

  it('shows card pictures, and opens audio/video media through the system', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openDeck({
      'GET /modules/tala/courses/A1/flashcards/c1': {
        data: {
          data: deck([
            card(0, {
              question_media: { type: 'image', url: 'https://cdn.example.com/q.png' },
              answer_media: { type: 'audio', url: 'https://cdn.example.com/a.mp3' },
            }),
          ]),
        },
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Study flashcards' }));
    expect(await screen.findByLabelText('Question picture')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show answer' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Play audio' }));
    expect(open).toHaveBeenCalledWith('https://cdn.example.com/a.mp3');
  });
});

describe('outbox kinds', () => {
  it('a newer flashcard result replaces the older one for the same set; completions keep their feedback', async () => {
    const api = mockApi({
      [POST]: { data: { data: RESULT } },
      'POST /modules/tala/courses/A1/progress': { data: { data: {} } },
    });
    signedInAs();
    await queueFlashcards('A1', 'c1', 'dv1', [{ index: 0, rating: 'easy' }]);
    await queueFlashcards('A1', 'c1', 'dv1', [{ index: 0, rating: 'hard' }]);
    await queueCompletion('A1', 'v1', { rating: 4, comment: 'Good' });
    await queueCompletion('A1', 'v1', { rating: 5, comment: 'Better' }); // replaced, not duplicated
    expect(await pendingCompletions()).toHaveLength(2);

    expect(await syncOutbox()).toMatchObject({ sent: 2, kept: 0 });
    expect(api.callsTo(POST)[0]?.body).toEqual({
      version: 'dv1',
      ratings: [{ index: 0, rating: 'hard' }],
    });
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
      completed: ['v1'],
      feedback: { v1: { rating: 5, comment: 'Better' } },
    });
  });

  it('items queued by an older build (no kind) are treated as completions', async () => {
    signedInAs();
    await AsyncStorage.setItem(
      `tala:v1:${currentScope()}:outbox`,
      JSON.stringify([
        { assignId: 'A1', materialId: 'v1', queuedAt: 'x', attempts: 0, lastError: null },
      ]),
    );
    expect((await pendingCompletions())[0]?.kind).toBe('completed');
  });
});
