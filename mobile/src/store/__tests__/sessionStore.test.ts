import type { Session } from '@/models/user';
import { api } from '@/services/api/client';
import { queryClient } from '@/services/queryClient';
import { loadSession } from '@/services/storage/secureStore';
import { useSessionStore } from '../sessionStore';

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

describe('session store', () => {
  beforeEach(async () => {
    await useSessionStore.getState().signOut();
    useSessionStore.setState({ status: 'bootstrapping' });
  });

  it('bootstraps to unauthenticated with no stored session', async () => {
    await useSessionStore.getState().bootstrap();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
  });

  it('persists on sign-in and restores on bootstrap', async () => {
    await useSessionStore.getState().signIn(session);
    useSessionStore.setState({ status: 'bootstrapping', session: null });
    await useSessionStore.getState().bootstrap();
    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', session });
  });

  it('sign-out clears storage, query cache and state (BR-06)', async () => {
    await useSessionStore.getState().signIn(session);
    queryClient.setQueryData(['documents', 'crew1'], [1, 2, 3]);
    await useSessionStore.getState().signOut();
    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', session: null });
    expect(queryClient.getQueryData(['documents', 'crew1'])).toBeUndefined();
    expect(await loadSession()).toBeNull();
  });

  it('a 401 from the API ends an authenticated session', async () => {
    await useSessionStore.getState().signIn(session);
    api.defaults.adapter = (config) =>
      Promise.reject(
        Object.assign(new Error('401'), {
          isAxiosError: true,
          config,
          response: { status: 401, data: {}, headers: {}, config },
        }),
      );
    await expect(api.get('/anything')).rejects.toMatchObject({ kind: 'unauthorized' });
    await new Promise((r) => setTimeout(r, 0));
    expect(useSessionStore.getState().status).toBe('unauthenticated');
  });
});
