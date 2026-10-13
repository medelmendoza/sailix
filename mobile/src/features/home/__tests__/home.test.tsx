import { act, fireEvent, screen } from '@testing-library/react-native';
import { useSessionStore } from '@/store/sessionStore';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

async function pullToRefresh() {
  const control = screen.getByTestId('home-scroll').props.refreshControl as {
    props: { onRefresh: () => void };
  };
  await act(async () => control.props.onRefresh());
}

describe('home', () => {
  it('greets the member and names the organization', async () => {
    signedInAs();
    await renderApp();
    expect(await screen.findByText('Hello, Maria')).toBeTruthy();
    expect(screen.getByText('Southfield Agencies')).toBeTruthy();
  });

  it('falls back to the display name or username when there is no profile', async () => {
    signedInAs(
      makeMe({
        profile: null,
        user: { id: 'u', username: 'admin1', email: 'a@example.test', display_name: 'Alex Admin' },
      }),
    );
    await renderApp();
    expect(await screen.findByText('Hello, Alex Admin')).toBeTruthy();
  });

  it('shows a refresh failure without losing what is on screen', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    mockApi({
      'GET /me': { networkError: true },
      'GET /modules/tala/courses': { data: { data: [] } },
    });
    await renderApp();
    await screen.findByText('Hello, Maria');

    await pullToRefresh();

    expect(await screen.findByText(/No connection/)).toBeTruthy();
    expect(screen.getByText('Hello, Maria')).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('a 403 organization suspension discovered on refresh leaves nothing behind', async () => {
    signedInAs();
    mockApi({ 'GET /me': problem(403, 'tenant_suspended') });
    await renderApp();
    await screen.findByText('Hello, Maria');

    await pullToRefresh();

    expect(await screen.findByText(/not active/)).toBeTruthy();
  });
});

describe('module screen', () => {
  async function openTala(status: string, enabled = true) {
    mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } });
    signedInAs(makeMe({ modules: [TALA(status, enabled)] }));
    await renderApp();
    await fireEvent.press(await screen.findByLabelText(/^Services/));
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
  }

  it('offers to link an existing account when not linked (and no courses are requested)', async () => {
    await openTala('not_linked');
    expect(await screen.findByText('Not linked')).toBeTruthy();
    expect(screen.getByText('Link your Tala account')).toBeTruthy();
    expect(screen.getByLabelText('Tala username or email')).toBeTruthy();
    expect(screen.getByLabelText('Tala password')).toBeTruthy();
  });

  it('shows the courses area when linked', async () => {
    await openTala('linked');
    expect(await screen.findByText('Linked')).toBeTruthy();
    expect(await screen.findByText('No courses assigned')).toBeTruthy();
  });

  it('asks for a re-link when the link expired, and says revoked access is the administrator’s call', async () => {
    await openTala('needs_relink');
    expect(await screen.findByText('Needs re-link')).toBeTruthy();
    expect(screen.getByText('Link your Tala account again')).toBeTruthy();
  });

  it('does not offer linking when access was revoked', async () => {
    await openTala('revoked');
    expect(await screen.findByText('Access revoked')).toBeTruthy();
    expect(screen.getByText(/was revoked/)).toBeTruthy();
    expect(screen.queryByLabelText('Tala password')).toBeNull();
  });

  it('explains a service the organization turned off, without any link form', async () => {
    await openTala('disabled', false);
    expect(await screen.findByText('Turned off')).toBeTruthy();
    expect(screen.getByText(/turned this service off/i)).toBeTruthy();
    expect(screen.queryByLabelText('Tala password')).toBeNull();
  });
});
