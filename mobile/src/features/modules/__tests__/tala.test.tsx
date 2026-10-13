import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem, type Call } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const course = (over = {}) => ({
  id: 'A1',
  name: 'Safety at sea',
  description: 'Basics',
  thumbnail_url: null,
  date_from: '2026-01-01',
  date_to: '2026-12-31',
  status: 'ongoing',
  progress: '50',
  total_materials: 3,
  ...over,
});
const detail = {
  ...course(),
  hidden_materials: 2,
  progress_submission: false,
  materials: [
    {
      id: 'v1',
      type: 'video',
      name: 'Intro video',
      description: null,
      thumbnail_url: null,
      viewable: true,
      progress: '100',
      status: 'done',
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
    },
    {
      id: 'q1',
      type: 'quiz',
      name: 'Final quiz',
      description: null,
      thumbnail_url: null,
      viewable: false,
      progress: null,
      status: null,
    },
  ],
};
const linkedMe = () => makeMe({ modules: [TALA('linked')] });
const unlinkedMe = (status = 'not_linked') => makeMe({ modules: [TALA(status)] });

async function openTala(me = linkedMe()) {
  signedInAs(me);
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('linking', () => {
  async function submit(username: string, password: string) {
    await fireEvent.changeText(await screen.findByLabelText('Tala username or email'), username);
    await fireEvent.changeText(screen.getByLabelText('Tala password'), password);
    await fireEvent.press(screen.getByRole('button', { name: 'Link account' }));
  }

  it('sends only the username and password, then shows the courses once /me says linked', async () => {
    let linked = false;
    const api = mockApi({
      'GET /me': () => ({ data: { data: linked ? linkedMe() : unlinkedMe() } }),
      'POST /modules/tala/link': () => {
        linked = true;
        return { data: { data: { status: 'linked', linked_at: 'x', last_verified_at: 'x' } } };
      },
      'GET /modules/tala/courses': { data: { data: [course()] } },
    });
    await openTala(unlinkedMe());
    await submit('maria', 'tala-secret');

    expect(await screen.findByText('Safety at sea')).toBeTruthy();
    const post = api.callsTo('POST /modules/tala/link')[0]!;
    expect(post.body).toEqual({ username: 'maria', password: 'tala-secret' });
    expect(api.callsTo('GET /modules/tala/courses').length).toBeGreaterThan(0);
  });

  it.each([
    ['link_failed', 422, /did not accept that username and password/],
    ['team_not_in_organization', 422, /does not belong to your organization's team/],
    ['external_account_taken', 409, /already linked to another Sailix user/],
    ['different_account_linked', 409, /already linked a different Tala account/],
    ['module_unavailable', 503, /not reachable right now/],
  ])('explains %s and clears the password field', async (code, status, text) => {
    mockApi({ 'POST /modules/tala/link': problem(status, code as string) });
    await openTala(unlinkedMe());
    await submit('maria', 'tala-secret');

    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByLabelText('Tala password').props.value).toBe('');
    expect(screen.getByLabelText('Tala username or email').props.value).toBe('maria');
  });

  it('validates locally without calling the server', async () => {
    const api = mockApi({});
    await openTala(unlinkedMe());
    await fireEvent.press(await screen.findByRole('button', { name: 'Link account' }));
    expect(await screen.findByText('Enter your Tala username or email.')).toBeTruthy();
    expect(screen.getByText('Enter your Tala password.')).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it('a link that needs re-linking says why', async () => {
    mockApi({});
    await openTala(unlinkedMe('needs_relink'));
    expect(await screen.findByText('Link your Tala account again')).toBeTruthy();
    expect(screen.getAllByText(/link expired/i).length).toBeGreaterThan(0);
  });
});

describe('courses', () => {
  it('lists the courses with due date and progress', async () => {
    mockApi({ 'GET /modules/tala/courses': { data: { data: [course()] } } });
    await openTala();
    expect(await screen.findByText('Safety at sea')).toBeTruthy();
    expect(screen.getByText('Due 2026-12-31')).toBeTruthy();
    expect(screen.getByText('3 items · 50% complete')).toBeTruthy();
  });

  it('shows a failure with a retry that recovers', async () => {
    let fail = true;
    mockApi({
      'GET /modules/tala/courses': () =>
        fail ? problem(503, 'module_unavailable') : { data: { data: [course()] } },
    });
    await openTala();
    expect(await screen.findByText(/not reachable right now/)).toBeTruthy();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Safety at sea')).toBeTruthy();
  });

  it('a rejected Tala token switches the screen to the re-link form', async () => {
    let relink = false;
    mockApi({
      'GET /me': () => ({ data: { data: relink ? unlinkedMe('needs_relink') : linkedMe() } }),
      'GET /modules/tala/courses': () => {
        relink = true;
        return problem(409, 'relink_required');
      },
    });
    await openTala();
    expect(await screen.findByText('Link your Tala account again')).toBeTruthy();
  });
});

describe('course detail', () => {
  const routes = () => ({
    'GET /modules/tala/courses': { data: { data: [course()] } },
    'GET /modules/tala/courses/A1': { data: { data: detail } },
  });

  async function openCourse() {
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
  }

  it('shows materials with progress, never offers a quiz, and says what is not supported', async () => {
    mockApi(routes());
    await openCourse();
    expect(await screen.findByText('Intro video')).toBeTruthy();
    expect(screen.getByText('Video · 100% · done')).toBeTruthy();
    expect(screen.getByText('Final quiz')).toBeTruthy();
    expect(screen.getByText(/Quizzes are not available in this version/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Watch|Open/ })).toHaveLength(2);
    expect(screen.getByText(/2 item\(s\) in this course are not supported/)).toBeTruthy();
    expect(screen.getByText(/Taking quizzes and recording progress is not available/)).toBeTruthy();
  });

  it('opens a video through the gateway-provided https address', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockApi({
      ...routes(),
      'GET /modules/tala/courses/A1/materials/v1': {
        data: {
          data: {
            id: 'v1',
            type: 'video',
            name: 'Intro video',
            description: null,
            thumbnail_url: null,
            file_url: 'https://files.example.com/v.mp4',
          },
        },
      },
    });
    await openCourse();
    await fireEvent.press(await screen.findByRole('button', { name: 'Watch' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files.example.com/v.mp4'));
  });

  it('explains a material without a file or a failing request', async () => {
    mockApi({
      ...routes(),
      'GET /modules/tala/courses/A1/materials/v1': problem(503, 'module_unavailable'),
    });
    await openCourse();
    await fireEvent.press(await screen.findByRole('button', { name: 'Watch' }));
    expect(await screen.findByText(/not reachable right now/)).toBeTruthy();
  });
});

describe('disconnecting', () => {
  it('asks first, removes the link, and returns to the link form', async () => {
    let linked = true;
    const api = mockApi({
      'GET /me': () => ({ data: { data: linked ? linkedMe() : unlinkedMe() } }),
      'GET /modules/tala/courses': { data: { data: [course()] } },
      'DELETE /modules/tala/link': () => {
        linked = false;
        return { status: 204 };
      },
    });
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: 'Disconnect Tala' }));
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
    expect(api.callsTo('DELETE /modules/tala/link')).toHaveLength(0); // nothing before the confirmation

    await act(async () => {
      buttons.find((b) => b.text === 'Disconnect')!.onPress!();
    });

    expect(await screen.findByText('Link your Tala account')).toBeTruthy();
    expect(api.callsTo('DELETE /modules/tala/link')).toHaveLength(1);
    expect(queryClient.getQueryCache().findAll({ queryKey: [undefined as never] })).toHaveLength(0);
  });
});

describe('trust boundaries', () => {
  it('never sends a Tala user id, team id, token or role: every gateway call is bare', async () => {
    const api = mockApi({
      'GET /modules/tala/courses': { data: { data: [course()] } },
      'GET /modules/tala/courses/A1': { data: { data: detail } },
    });
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    await screen.findByText('Intro video');

    const gateway = api.calls.filter((c: Call) => c.path.startsWith('/modules/tala'));
    expect(gateway.length).toBeGreaterThan(1);
    for (const call of gateway) {
      expect(call.path).not.toMatch(/[?&=]/); // no query string at all
      expect(call.body).toBeNull();
      expect(JSON.stringify(call.headers)).not.toMatch(/teamId|userId|X-Tala/i);
    }
  });
});
