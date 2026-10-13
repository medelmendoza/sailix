import { useNetInfo } from '@react-native-community/netinfo';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useSessionStore } from '@/store/sessionStore';
import { saveCredential } from '@/services/storage/secureStore';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const stored = {
  token: '1|stored',
  expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  membershipId: 'm1',
  tenantId: 't1',
  tenantCode: 'SFAI',
};

describe('auth gate (state, not navigation calls)', () => {
  it('shows a loader while the stored session is being checked', async () => {
    useSessionStore.setState({ status: 'bootstrapping' });
    await renderApp();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('shows sign-in when signed out', async () => {
    useSessionStore.setState({ status: 'unauthenticated' });
    await renderApp();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('shows the app when signed in', async () => {
    signedInAs();
    await renderApp();
    expect(await screen.findByText('Hello, Maria')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('a session that ends elsewhere (state change) swaps the app for sign-in with no navigate call', async () => {
    signedInAs();
    await renderApp();
    await screen.findByText('Hello, Maria');

    await act(async () => {
      await useSessionStore
        .getState()
        .signOut({ notice: 'Your organization is not active.', revoke: false });
    });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('Your organization is not active.')).toBeTruthy();
    expect(screen.queryByText('Hello, Maria')).toBeNull();
  });

  it('restores a stored session at launch', async () => {
    await saveCredential(stored);
    mockApi({ 'GET /me': { data: { data: makeMe() } } });
    await useSessionStore.getState().bootstrap();
    await renderApp();
    expect(await screen.findByText('Hello, Maria')).toBeTruthy();
  });
});

describe('unreachable server at launch', () => {
  it('offers a retry and keeps the person signed in', async () => {
    await saveCredential(stored);
    const api = mockApi({ 'GET /me': { networkError: true } });
    await useSessionStore.getState().bootstrap();
    await renderApp();

    expect(await screen.findByText('Cannot reach Sailix')).toBeTruthy();
    expect(screen.getByText(/You are still signed in/)).toBeTruthy();

    api.set('GET /me', { data: { data: makeMe() } });
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Hello, Maria')).toBeTruthy();
  });

  it('lets the person sign out locally from that screen', async () => {
    await saveCredential(stored);
    mockApi({ 'GET /me': problem(503, 'server_error') });
    await useSessionStore.getState().bootstrap();
    await renderApp();

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(useSessionStore.getState().credential).toBeNull();
  });
});

describe('connectivity', () => {
  it('shows an offline banner inside the app while the device has no connection', async () => {
    signedInAs();
    (useNetInfo as jest.Mock).mockReturnValue({ isConnected: false });
    await renderApp();
    expect(await screen.findByText('You are offline.')).toBeTruthy();
  });

  it('shows no banner while connected', async () => {
    signedInAs();
    (useNetInfo as jest.Mock).mockReturnValue({ isConnected: true });
    await renderApp();
    await screen.findByText('Hello, Maria');
    expect(screen.queryByText('You are offline.')).toBeNull();
  });
});
