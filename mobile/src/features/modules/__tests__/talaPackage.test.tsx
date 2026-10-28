import { fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { brandPalette } from '@/theme/brand';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { openTala } from '@/test-utils/steps';
import { buildTalaHost } from '../talaHost';

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
