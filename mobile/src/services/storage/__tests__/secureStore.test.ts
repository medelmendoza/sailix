import * as SecureStore from 'expo-secure-store';
import type { Session } from '@/models/user';
import { clearSession, loadSession, saveSession } from '../secureStore';

const session: Session = {
  token: 'tok',
  user: {
    userId: 'usr1',
    crewId: 'crew1',
    username: 'jdoe',
    firstName: 'Jane',
    lastName: 'Doe',
    fullName: 'Doe, Jane',
    email: 'j@example.test',
    mobile: '0917',
    birthDate: '1990-01-02',
    clientCode: 'SFAI',
  },
};

describe('secureStore', () => {
  beforeEach(clearSession);

  it('round-trips a session', async () => {
    await saveSession(session);
    expect(await loadSession()).toEqual(session);
  });

  it('treats a partial session (token only) as no session', async () => {
    await SecureStore.setItemAsync('sailix.token', 'tok');
    expect(await loadSession()).toBeNull();
  });

  it('treats corrupt profile JSON as no session', async () => {
    await SecureStore.setItemAsync('sailix.token', 'tok');
    await SecureStore.setItemAsync('sailix.profile', '{not json');
    expect(await loadSession()).toBeNull();
  });

  it('clears everything', async () => {
    await saveSession(session);
    await clearSession();
    expect(await loadSession()).toBeNull();
  });
});
