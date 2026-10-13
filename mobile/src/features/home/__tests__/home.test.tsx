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

  it('says so plainly when the organization offers no services', async () => {
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    expect(await screen.findByText('No services yet')).toBeTruthy();
  });

  it('lists each service with its real status from the API', async () => {
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    expect(await screen.findByRole('button', { name: 'Tala, Not linked' })).toBeTruthy();
  });

  it('pull-to-refresh reloads /me and shows module changes', async () => {
    signedInAs(makeMe({ modules: [] }));
    const api = mockApi({ 'GET /me': { data: { data: makeMe({ modules: [TALA('linked')] }) } } });
    await renderApp();
    await screen.findByText('No services yet');

    await pullToRefresh();

    expect(await screen.findByRole('button', { name: 'Tala, Linked' })).toBeTruthy();
    expect(api.callsTo('GET /me')).toHaveLength(1);
  });

  it('shows a refresh failure without losing what is on screen', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    mockApi({ 'GET /me': { networkError: true } });
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
    signedInAs(makeMe({ modules: [TALA(status, enabled)] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
  }

  it('does not pretend content exists: it says course content and linking are not available yet', async () => {
    await openTala('not_linked');
    expect(await screen.findByText('Not linked')).toBeTruthy();
    expect(
      screen.getByText(/courses and account linking are not available in this version/i),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /link/i })).toBeNull(); // no fake action
  });

  it.each([
    ['linked', 'Linked', /Your account is linked/],
    ['needs_relink', 'Needs re-link', /link expired/],
    ['revoked', 'Access revoked', /was revoked/],
  ])('describes the %s state', async (status, label, text) => {
    await openTala(status);
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('explains a service the organization turned off, without the "not available yet" notice', async () => {
    await openTala('disabled', false);
    expect(await screen.findByText('Turned off')).toBeTruthy();
    expect(screen.getByText(/turned this service off/i)).toBeTruthy();
    expect(screen.queryByText(/not available in this version/i)).toBeNull();
  });
});
