import type { Me } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';
import { makeMe } from './fixtures';

/** Put the store in an authenticated state without going through the network. */
export function signedInAs(me: Me = makeMe(), token = '1|test-token') {
  useSessionStore.setState({
    status: 'authenticated',
    me,
    notice: null,
    credential: {
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      membershipId: me.membership.id,
      tenantId: me.tenant.id,
      tenantCode: me.tenant.code,
    },
  });
}
