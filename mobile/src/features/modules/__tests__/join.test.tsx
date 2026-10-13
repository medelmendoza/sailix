import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

async function openJoin(routes: Record<string, unknown> = {}) {
  const api = mockApi({
    'GET /modules/tala/courses': { data: { data: [] } },
    ...routes,
  } as never);
  signedInAs(makeMe({ modules: [TALA('linked')] }));
  await renderApp();
  await fireEvent.press(await screen.findByLabelText(/^Services/));
  await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Join a course' }));
  return api;
}

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Request to join' }));
const type = (v: string) => fireEvent.changeText(screen.getByLabelText('Course code'), v);

describe('join a course', () => {
  it('sends only the trimmed code and says the request was sent, not that the course was joined', async () => {
    const api = await openJoin({
      'POST /modules/tala/courses/join': { status: 202, data: { data: { status: 'requested' } } },
    });
    await type('  ABC-123 ');
    await submit();

    expect(await screen.findByText(/Request sent/)).toBeTruthy();
    expect(screen.queryByText(/joined/i)).toBeNull();
    expect(api.callsTo('POST /modules/tala/courses/join')[0]?.body).toEqual({ code: 'ABC-123' });
  });

  it('refreshes the course list after a request', async () => {
    const api = await openJoin({
      'POST /modules/tala/courses/join': { status: 202, data: { data: { status: 'requested' } } },
    });
    await type('ABC-123');
    await submit();
    await screen.findByText(/Request sent/);
    await waitFor(() => expect(api.callsTo('GET /modules/tala/courses').length).toBeGreaterThan(1));
  });

  it('does not send an empty or malformed code', async () => {
    const api = await openJoin();
    await submit();
    expect(await screen.findByText('Enter the course code.')).toBeTruthy();
    await type('has space');
    await submit();
    expect(await screen.findByText(/only letters, numbers/)).toBeTruthy();
    expect(api.callsTo('POST /modules/tala/courses/join')).toHaveLength(0);
  });

  it.each([
    [
      'a code Tala does not accept',
      problem(422, 'course_code_rejected'),
      'That course code was not accepted. Check it and try again.',
    ],
    [
      'the feature being off',
      problem(403, 'feature_disabled'),
      'This feature is not turned on yet.',
    ],
    [
      'Tala being unreachable',
      problem(503, 'module_unavailable'),
      'This service is not reachable right now. Try again later.',
    ],
    ['too many tries', problem(429, 'throttled'), 'Too many attempts. Try again shortly.'],
  ])('explains %s without claiming success', async (_n, reply, message) => {
    await openJoin({ 'POST /modules/tala/courses/join': reply });
    await type('ABC-123');
    await submit();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText(/Request sent/)).toBeNull();
  });
});
