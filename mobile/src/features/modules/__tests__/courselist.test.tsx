import { fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { openTala } from '@/test-utils/steps';

const course = (n: number, name = `Course ${String(n).padStart(2, '0')}`) => ({
  id: `A${n}`,
  name,
  description: null,
  thumbnail_url: null,
  date_from: null,
  date_to: null,
  status: 'NOT YET COMPLETED',
  progress: '0/4',
  completed: 0,
  total: 4,
  percent: 0,
  state: 'not_started',
  total_materials: 3,
});
const many = (count: number) => Array.from({ length: count }, (_, i) => course(i + 1));

async function open(list: unknown[]) {
  mockApi({ 'GET /modules/tala/courses': { data: { data: list } } } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await renderApp();
  await openTala();
}
const names = () => screen.queryAllByText(/^Course \d\d$/).map((n) => n.props.children as string);

describe('searching the courses', () => {
  it('filters by name as you type, ignoring case and accents, and clears with one tap', async () => {
    await open([course(1, 'Navigación segura'), course(2, 'Fire Safety'), course(3, 'First Aid')]);
    const box = await screen.findByLabelText('Search courses');

    await fireEvent.changeText(box, 'navegacion'); // a different word, so no match
    expect(screen.queryByText('Navigación segura')).toBeNull();
    expect(await screen.findByText('No courses match')).toBeTruthy();

    await fireEvent.changeText(box, 'navigacion');
    expect(await screen.findByText('Navigación segura')).toBeTruthy(); // the accent does not matter
    expect(screen.queryByText('Fire Safety')).toBeNull();

    await fireEvent.changeText(box, 'fi'); // two courses start with "fi"
    expect(await screen.findByText('Fire Safety')).toBeTruthy();
    expect(screen.getByText('First Aid')).toBeTruthy();
    expect(screen.queryByText('Navigación segura')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Navigación segura')).toBeTruthy();
    expect(screen.getByText('Fire Safety')).toBeTruthy();
  });

  it('has no search box when there are no courses', async () => {
    await open([]);
    expect(await screen.findByText('No courses assigned')).toBeTruthy();
    expect(screen.queryByLabelText('Search courses')).toBeNull();
  });
});

describe('showing the courses a page at a time', () => {
  it('shows ten, then ten more on each "Show more", and the count', async () => {
    await open(many(25));
    expect(await screen.findByText('Course 01')).toBeTruthy();
    expect(names()).toHaveLength(10);
    expect(screen.getByText('Showing 10 of 25 courses')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show more courses, 15 left' }));
    expect(names()).toHaveLength(20);
    expect(screen.getByText('Showing 20 of 25 courses')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show more courses, 5 left' }));
    expect(names()).toHaveLength(25);
    expect(screen.getByText('Showing 25 of 25 courses')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Show more/ })).toBeNull(); // nothing left
  });

  it('shows no paging controls for a short list', async () => {
    await open(many(10));
    expect(await screen.findByText('Course 10')).toBeTruthy();
    expect(screen.queryByText(/^Showing /)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Show more/ })).toBeNull();
  });

  it('searches every course, not just the ones shown, and starts again from the first page', async () => {
    await open(many(25));
    await screen.findByText('Course 01');
    expect(screen.queryByText('Course 23')).toBeNull(); // on a later page

    await fireEvent.changeText(screen.getByLabelText('Search courses'), 'course 23');
    expect(await screen.findByText('Course 23')).toBeTruthy(); // found although it was not on the first page
    expect(names()).toEqual(['Course 23']);

    await fireEvent.changeText(screen.getByLabelText('Search courses'), 'course 2'); // 20 to 25
    expect(names()).toHaveLength(6);

    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(names()).toHaveLength(10); // back to the first page
  });
});
