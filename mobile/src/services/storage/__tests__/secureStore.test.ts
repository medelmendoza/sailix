import * as SecureStore from 'expo-secure-store';
import type { Credential } from '@/models/session';
import { clearCredential, loadCredential, saveCredential } from '../secureStore';

const credential: Credential = {
  token: '1|secret-token',
  expiresAt: '2026-12-01T00:00:00+00:00',
  membershipId: 'm1',
  tenantId: 't1',
  tenantCode: 'SFAI',
};
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe('secure credential storage', () => {
  it('round-trips a credential', async () => {
    await saveCredential(credential);
    expect(await loadCredential()).toEqual(credential);
  });

  it('keeps the token apart from the metadata and stores no personal data', async () => {
    await saveCredential(credential);
    const entries = [...store().entries()];
    expect(entries).toHaveLength(2);
    const meta = entries.find(([k]) => k.endsWith('credential'))![1];
    expect(meta).not.toContain('secret-token');
    expect(Object.keys(JSON.parse(meta)).sort()).toEqual([
      'expiresAt',
      'membershipId',
      'tenantCode',
      'tenantId',
    ]);
  });

  it('writes with the this-device-only, when-unlocked keychain class', async () => {
    await saveCredential(credential);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
  });

  it('treats a partial or corrupt credential as none', async () => {
    store().set('sailix.token', 'only-a-token');
    expect(await loadCredential()).toBeNull();
    store().set('sailix.credential', '{not json');
    expect(await loadCredential()).toBeNull();
    store().set('sailix.credential', JSON.stringify({ membershipId: 1 }));
    expect(await loadCredential()).toBeNull();
  });

  it('clears everything', async () => {
    await saveCredential(credential);
    await clearCredential();
    expect(store().size).toBe(0);
    expect(await loadCredential()).toBeNull();
  });
});
