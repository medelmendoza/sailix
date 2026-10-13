import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

/** The layout of the original Tala app: picture cards in the list; picture, info, description and materials in a course. */
const course = (over = {}) => ({
  id: 'A1',
  name: 'Fire Safety at Sea',
  description: 'Learn the essentials.',
  thumbnail_url: null,
  creator: 'Capt. Reyes',
  date_from: '2020-01-01',
  date_to: '2099-12-31',
  status: 'NOT YET COMPLETED',
  progress: '1/4',
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
  total_materials: 4,
  ...over,
});
const mat = (id: string, type: string, name: string, over = {}) => ({
  id,
  type,
  name,
  description: null,
  thumbnail_url: null,
  viewable: true,
  progress: null,
  status: null,
  stats: null,
  ...over,
});
const detail = (over = {}) => ({
  ...course(),
  hidden_materials: 0,
  progress_submission: true,
  materials: [
    mat('v1', 'video', 'Intro video'),
    mat('p1', 'pdf', 'Manual'),
    mat('q1', 'quiz', 'Final quiz'),
    mat('c1', 'flashcards', 'Safety symbols'),
  ],
  ...over,
});

async function open(list: unknown[], d: unknown = detail()) {
  mockApi({
    'GET /modules/tala/courses': { data: { data: list } },
    'GET /modules/tala/courses/A1': { data: { data: d } },
    'GET /modules/tala/courses/A1/flashcards/c1': {
      data: {
        data: {
          id: 'c1',
          name: 'Safety symbols',
          version: null,
          cards: [{ index: 0, front: 'Q', back: 'A' }],
        },
      },
    },
  } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await renderApp();
  await fireEvent.press(await screen.findByLabelText(/^Services/));
  await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
}

describe('course list', () => {
  it('shows each course as a card with its title, creator and time left', async () => {
    await open([course(), course({ id: 'A2', name: 'First Aid', creator: null, date_to: null })]);
    expect(await screen.findByText('Fire Safety at Sea')).toBeTruthy();
    expect(screen.getByText('Capt. Reyes')).toBeTruthy();
    expect(screen.getByText('Unknown creator')).toBeTruthy(); // no creator recorded
    expect(screen.getByText('No due date')).toBeTruthy();
    expect(screen.getByText(/days left/)).toBeTruthy();
  });

  it('a course without a picture shows the soft placeholder (its first letter), never a broken image', async () => {
    await open([course()]);
    await screen.findByText('Fire Safety at Sea');
    expect(screen.getByText('F', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('course detail', () => {
  async function detailScreen(d: unknown = detail()) {
    await open([course()], d);
    await fireEvent.press(await screen.findByRole('button', { name: /Fire Safety at Sea/ }));
    await screen.findByText('Materials');
  }

  it('is laid out as picture, info, description, then materials', async () => {
    await detailScreen();
    expect(screen.getByText('Creator : Capt. Reyes')).toBeTruthy();
    expect(screen.getByText(/^Due : /)).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Learn the essentials.')).toBeTruthy();
    const order = screen.getAllByRole('header').map((h) => h.props.children);
    expect(order.indexOf('Description')).toBeLessThan(order.indexOf('Materials'));
  });

  it('lists every kind of material with its type, status and an open action', async () => {
    await detailScreen();
    for (const [name, type] of [
      ['Intro video', 'Video'],
      ['Manual', 'PDF'],
      ['Final quiz', 'Quiz'],
      ['Safety symbols', 'Flashcards'],
    ]) {
      expect(screen.getByText(name!)).toBeTruthy();
      expect(screen.getAllByText(`Type : ${type}`).length).toBe(1);
    }
    expect(screen.getAllByText('Status : Not started').length).toBe(4);
    for (const open of [
      /^Watch: Intro video/,
      /^Open: Manual/,
      /^Take quiz: Final quiz/,
      /^Study flashcards: Safety symbols/,
    ]) {
      expect(screen.getByRole('button', { name: open })).toBeTruthy();
    }
  });

  it('only video and PDF rows have a download icon; quizzes and flashcards open in the app', async () => {
    await detailScreen();
    expect(screen.getAllByRole('button', { name: 'Download for offline' })).toHaveLength(2);
  });

  it('opens a flashcard set by tapping its row', async () => {
    await detailScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Study flashcards/ }));
    expect(screen.queryByText('Materials')).toBeNull(); // moved on to the flashcards screen
  });

  it('says plainly that an item is not available, and does not let it be opened', async () => {
    await detailScreen(
      detail({
        progress_submission: false,
        materials: [mat('q1', 'quiz', 'Final quiz', { viewable: false })],
      }),
    );
    expect(screen.getByText(/Quizzes are not available in this version/)).toBeTruthy();
    const row = screen.getByRole('button', { name: /Final quiz, not available/ });
    expect(row.props.accessibilityState.disabled).toBe(true);
  });

  it('shows the placeholder initial for a course without a picture', async () => {
    await detailScreen();
    expect(screen.getAllByText('F', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('a course with no description says so, and no materials says so', async () => {
    await detailScreen(detail({ description: null, materials: [] }));
    expect(screen.getByText('No description.')).toBeTruthy();
    expect(screen.getByText('No materials yet.')).toBeTruthy();
  });
});
