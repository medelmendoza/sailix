import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const course = (id: string, name: string, over = {}) => ({
  id,
  name,
  description: null,
  thumbnail_url: null,
  date_from: day(-30),
  date_to: day(30),
  status: 'NOT YET COMPLETED',
  progress: '1/4',
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
  total_materials: 3,
  ...over,
});
const LIST = [
  course('A1', 'Fire safety', { date_to: day(-2) }), // overdue
  course('A2', 'First aid', { date_to: day(3), completed: 3, total: 4, percent: 75 }), // soon
  course('A3', 'Navigation', {
    date_to: day(60),
    completed: 0,
    percent: 0,
    state: 'not_started',
    status: 'INACTIVE',
    progress: null,
  }),
  course('A4', 'Seamanship', {
    date_to: day(-100),
    completed: 4,
    percent: 100,
    state: 'completed',
    status: 'COMPLETED',
    progress: '4/4',
  }),
];

async function home(courses: unknown, extra: Record<string, unknown> = {}) {
  const api = mockApi({ 'GET /modules/tala/courses': courses as never, ...extra } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await renderApp();
  return api;
}

describe('home: my learning', () => {
  it('shows overall progress and the most urgent due dates, overdue first', async () => {
    await home({ data: { data: LIST } });

    expect(await screen.findByText('My learning')).toBeTruthy();
    expect(screen.getByText(/8 of 16 items completed · 1 of 4 courses completed/)).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Overall progress' }).props.accessibilityValue.now,
    ).toBe(50);
    expect(screen.getByRole('button', { name: /Fire safety, Overdue by 2 days/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /First aid, 3 days left/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Navigation, 60 days left/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Seamanship/ })).toBeNull(); // finished courses are not "due"
  });

  it('does not appear when Tala is not linked, and never blocks Home when Tala fails or is empty', async () => {
    const api = mockApi({});
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    expect(await screen.findByText('Services')).toBeTruthy();
    expect(screen.queryByText('My learning')).toBeNull();
    expect(api.callsTo('GET /modules/tala/courses')).toHaveLength(0);
  });

  it('stays out of the way on a Tala outage', async () => {
    await home({
      status: 503,
      data: { code: 'module_unavailable', type: 'x', title: 'x', status: 503 },
    });
    expect(await screen.findByText('Hello, Maria')).toBeTruthy(); // Home still works
    expect(screen.queryByText('My learning')).toBeNull();
  });

  it('opens the course from a due date and the stats from the button', async () => {
    await home(
      { data: { data: LIST } },
      {
        'GET /modules/tala/courses/A2': {
          data: {
            data: { ...LIST[1], hidden_materials: 0, progress_submission: false, materials: [] },
          },
        },
      },
    );
    await fireEvent.press(await screen.findByRole('button', { name: /First aid, 3 days left/ }));
    expect(await screen.findByText('3 of 4 items completed · In progress')).toBeTruthy();
  });
});

describe('my stats screen', () => {
  async function openStats(courses: unknown) {
    await home(courses);
    await fireEvent.press(await screen.findByRole('button', { name: 'See my stats' }));
  }

  it('summarizes everything and lists courses most urgent first', async () => {
    await openStats({ data: { data: LIST } });

    expect(await screen.findByText('8 of 16 items completed (50%)')).toBeTruthy();
    expect(screen.getByText('1 completed · 2 in progress · 1 not started')).toBeTruthy();
    expect(screen.getByText(/Next due: Fire safety · Overdue by 2 days/)).toBeTruthy();
    const names = screen
      .getAllByRole('button', { name: /items completed$/ })
      .map((b) => b.props.accessibilityLabel.split(',')[0]);
    expect(names).toEqual(['Fire safety', 'First aid', 'Navigation', 'Seamanship']);
    expect(screen.getByText('3 of 4 items completed · In progress')).toBeTruthy();
    expect(screen.getByText('0 of 4 items completed · Not started')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('shows an empty state for no courses', async () => {
    await home({ data: { data: [] } }, {});
    // nothing to show on Home; open the stats from the module screen instead
    await fireEvent.press(await screen.findByLabelText(/^Services/));
    await fireEvent.press(await screen.findByRole('button', { name: 'Tala, Linked' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'My stats' }));
    expect(await screen.findByText('No courses yet')).toBeTruthy();
  });
});

describe('course detail: progress and achievements', () => {
  it('shows the bar, the due date and what was achieved on each item', async () => {
    const detail = {
      ...LIST[1],
      hidden_materials: 0,
      progress_submission: true,
      materials: [
        {
          id: 'v1',
          type: 'video',
          name: 'Intro',
          description: null,
          thumbnail_url: null,
          viewable: true,
          progress: null,
          status: 'COMPLETED',
          stats: { rating: 4.5 },
        },
        {
          id: 'q1',
          type: 'quiz',
          name: 'Final quiz',
          description: null,
          thumbnail_url: null,
          viewable: true,
          progress: null,
          status: 'COMPLETED',
          stats: { correct: 8, wrong: 2, average: 80, remarks: 'PASSED' },
        },
        {
          id: 'q2',
          type: 'quiz',
          name: 'Retry quiz',
          description: null,
          thumbnail_url: null,
          viewable: true,
          progress: null,
          status: 'COMPLETED',
          stats: { correct: 3, wrong: 7, average: 30, remarks: 'FAILED' },
        },
        {
          id: 'c1',
          type: 'flashcards',
          name: 'Cards',
          description: null,
          thumbnail_url: null,
          viewable: true,
          progress: null,
          status: 'COMPLETED',
          stats: { easy: 5, medium: 7, hard: 8, notseen: 0 },
        },
        {
          id: 'p1',
          type: 'pdf',
          name: 'Manual',
          description: null,
          thumbnail_url: null,
          viewable: true,
          progress: null,
          status: null,
          stats: null,
        },
      ],
    };
    await home(
      { data: { data: LIST } },
      { 'GET /modules/tala/courses/A2': { data: { data: detail } } },
    );
    await fireEvent.press(await screen.findByRole('button', { name: /First aid, 3 days left/ }));

    expect(await screen.findByRole('progressbar', { name: 'First aid progress' })).toBeTruthy();
    expect(screen.getByText(/Your rating: 4.5 of 5/)).toBeTruthy();
    expect(screen.getByText(/Score 80% · Passed \(8 correct, 2 wrong\)/)).toBeTruthy();
    expect(screen.getByText(/Score 30% · Not passed \(3 correct, 7 wrong\)/)).toBeTruthy();
    expect(screen.getByText(/Easy 5 · Medium 7 · Hard 8/)).toBeTruthy();
  });
});
