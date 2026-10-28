import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { brandPalette } from '@/theme/brand';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { useSessionStore } from '@/store/sessionStore';
import { openTala } from '@/test-utils/steps';
import { buildTalaHost, useTalaHost } from '../talaHost';

const extra = () => Constants.expoConfig!.extra as Record<string, unknown>;
afterEach(() => {
  delete extra().talaPackage;
  delete extra().talaBaseUrl;
});

const credential = { tenantId: 7, membershipId: 42 } as never;
const brand = brandPalette({ primary_color: '#0A7F4F', background_color: '#FFFFFF' });

describe('Tala from Services', () => {
  it('opens Sailix\'s own Tala while the package flag is off', async () => {
    mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } } as never);
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await openTala();
    expect(await screen.findByRole('button', { name: 'My stats' })).toBeTruthy();
    expect(screen.queryByLabelText('Tala username or email')).toBeNull();
  });

  it('opens the Tala package, with its own sign-in, while the flag is on', async () => {
    extra().talaPackage = true;
    extra().talaBaseUrl = 'https://tala.example.test';
    mockApi({} as never);
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    await openTala();
    expect(await screen.findByLabelText('Tala username or email')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My stats' })).toBeNull();
  });

  it('says it is not available when Tala is not set up for this build', async () => {
    extra().talaPackage = true; // no Tala address in the build
    mockApi({} as never);
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    await openTala();
    expect(await screen.findByText('Tala is not available')).toBeTruthy();
  });

  it('still shows a service the organization has turned off, even with the flag on', async () => {
    extra().talaPackage = true;
    extra().talaBaseUrl = 'https://tala.example.test';
    mockApi({} as never);
    signedInAs(makeMe({ modules: [TALA('disabled', false)] }));
    await renderApp();
    await openTala();
    expect(await screen.findByText('Turned off')).toBeTruthy();
    expect(screen.queryByLabelText('Tala username or email')).toBeNull();
    void fireEvent;
  });
});

describe('the host Sailix gives the package', () => {
  const onExit = jest.fn();
  const base = { credential, brand, fontPreset: 'rounded', onExit };

  it('namespaces storage by organization and member', () => {
    const a = buildTalaHost({ ...base, extra: {} });
    const b = buildTalaHost({ ...base, credential: { tenantId: 7, membershipId: 43 } as never, extra: {} });
    expect(a.scope).toBe('org:7:member:42');
    expect(b.scope).not.toBe(a.scope);
  });

  it('carries the organization look, the build settings and the way back', () => {
    const host = buildTalaHost({ ...base, extra: { talaBaseUrl: 'https://t.example.test', talaProgressWrites: true } });
    expect(host.theme).toMatchObject({ primary: '#0A7F4F', background: '#FFFFFF', fontPreset: 'rounded' });
    expect(host.config).toEqual({ talaBaseUrl: 'https://t.example.test', progressWrites: true });
    host.onExit!();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('keeps progress writes off unless the build turns them on', () => {
    expect(buildTalaHost({ ...base, extra: {} }).config).toMatchObject({ talaBaseUrl: '', progressWrites: false });
  });
});

describe('the host stays the same object', () => {
  it('while only the session token or the look object is renewed (each app foreground does that)', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    const onExit = jest.fn();
    const { result } = await renderHook(() => useTalaHost(onExit));
    const first = result.current;
    expect(first).not.toBeNull();
    await act(async () => {
      const c = useSessionStore.getState().credential!;
      useSessionStore.setState({ credential: { ...c, token: 'renewed' }, me: { ...useSessionStore.getState().me! } });
    });
    expect(result.current).toBe(first);
  });
});

describe('signing out of Sailix', () => {
  it('also forgets the Tala tokens kept for that member', async () => {
    mockApi({ 'DELETE /auth/token': { status: 204 } } as never);
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    const c = useSessionStore.getState().credential!;
    const key = `tala.org_${c.tenantId}_member_${c.membershipId}.session`;
    await SecureStore.setItemAsync(key, '{"accessToken":"a","userId":"u"}');
    await useSessionStore.getState().signOut();
    expect(await SecureStore.getItemAsync(key)).toBeNull();
  });
});
