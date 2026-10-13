import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todo = (id: string, description: string, over: Record<string, unknown> = {}) => ({
  id,
  description,
  due_date: day(5),
  is_done: false,
  done_at: null,
  created_at: new Date().toISOString(),
  ...over,
});
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  data: {
    data: items,
    links: {},
    meta: { current_page: 1, per_page: 20, total: items.length, last_page: 1 },
    open_count: items.filter((t) => !(t as { is_done: boolean }).is_done).length,
    overdue_count: 0,
    ...over,
  },
});

async function openList(routes: Record<string, unknown>) {
  const api = mockApi({ 'GET /todos': page([]), ...routes } as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: 'See all to-dos' }));
  return api;
}

describe('dashboard to-do card', () => {
  it('shows the next open tasks with when they are due', async () => {
    mockApi({
      'GET /todos': page([
        todo('t1', 'Renew passport', { due_date: day(-2) }),
        todo('t2', 'Sign form', { due_date: day(1) }),
      ]),
    } as never);
    signedInAs(makeMe({ modules: [] }));
    await renderApp();

    expect(await screen.findByText('To-do (2)')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Renew passport, Overdue by 2 days' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Sign form, Due tomorrow' })).toBeTruthy();
  });

  it('renders nothing when nothing is open', async () => {
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await screen.findByText('Hello, Maria');
    expect(screen.queryByRole('header', { name: /^To-do/ })).toBeNull();
  });
});

describe('to-do list', () => {
  it('lists the open tasks, notes how many are overdue, and says when there are none', async () => {
    await openList({
      'GET /todos': page(
        [
          todo('t1', 'Renew passport', { due_date: day(-3) }),
          todo('t2', 'Later', { due_date: day(8) }),
        ],
        { overdue_count: 1 },
      ),
    });
    expect(await screen.findByText('1 task is overdue.')).toBeTruthy();
    expect(
      screen.getAllByRole('checkbox', { name: /^Renew passport, Overdue by 3 days/ }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the empty state for no open tasks', async () => {
    mockApi({ 'GET /todos': page([todo('t1', 'x')]) } as never);
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'See all to-dos' }));
    mockApi({ 'GET /todos': page([]) } as never);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Done' }));
    expect(await screen.findByText('Nothing done yet')).toBeTruthy();
  });

  it('ticks a task at once and sends only is_done', async () => {
    const api = await openList({
      'GET /todos': page([todo('t1', 'Sign form')]),
      'PATCH /todos/t1': { data: { data: todo('t1', 'Sign form', { is_done: true }) } },
    });
    const box = (await screen.findAllByRole('checkbox', { name: /^Sign form/ }))[0]!;
    await fireEvent.press(box);

    await waitFor(() => expect(api.callsTo('PATCH /todos/t1')).toHaveLength(1));
    expect(api.callsTo('PATCH /todos/t1')[0]?.body).toEqual({ is_done: true });
  });

  it('puts the tick back when the server refuses', async () => {
    await openList({
      'GET /todos': page([todo('t1', 'Sign form')]),
      'PATCH /todos/t1': problem(404, 'not_found'),
    });
    await fireEvent.press((await screen.findAllByRole('checkbox', { name: /^Sign form/ }))[0]!);

    await waitFor(() =>
      expect(
        screen.getAllByRole('checkbox', { name: /^Sign form/ })[0]!.props.accessibilityState
          .checked,
      ).toBe(false),
    );
  });

  it('shows a task description as plain text', async () => {
    await openList({ 'GET /todos': page([todo('t1', 'Bring <b>passport</b>')]) });
    expect((await screen.findAllByText('Bring <b>passport</b>')).length).toBeGreaterThan(0);
  });

  it('offers a retry when it cannot load', async () => {
    mockApi({ 'GET /todos': page([todo('t1', 'x')]) } as never);
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'See all to-dos' }));
    mockApi({ 'GET /todos': problem(500, 'server_error') } as never);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
