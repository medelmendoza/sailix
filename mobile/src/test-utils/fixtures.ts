import type { Me, TokenGrant } from '@/services/api/types';

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    user: { id: 'u1', username: 'maria', email: 'maria@example.test', display_name: null },
    membership: { id: 'm1', role: 'crew', status: 'active' },
    tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
    profile: {
      first_name: 'Maria',
      middle_name: null,
      last_name: 'Santos',
      suffix: null,
      mobile: null,
    },
    abilities: ['module.tala.use'],
    modules: [],
    memberships: [
      {
        id: 'm1',
        role: 'crew',
        tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
        current: true,
      },
    ],
    ...overrides,
  };
}

export function makeGrant(overrides: Partial<TokenGrant> = {}): TokenGrant {
  return {
    token: '1|plain-token',
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    membership: {
      id: 'm1',
      role: 'crew',
      tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies' },
    },
    ...overrides,
  };
}

export const TALA = (status: string, enabled = true) => ({
  code: 'tala' as const,
  label: 'Tala',
  enabled,
  linked: status === 'linked',
  status: status as 'disabled' | 'not_linked' | 'linked' | 'needs_relink' | 'revoked',
});

export const ASTRA = (enabled = true) => ({
  code: 'astra' as const,
  label: 'Astra',
  enabled,
  linked: enabled,
  status: (enabled ? 'available' : 'disabled') as 'available' | 'disabled',
});

export const CALLIT = (enabled = true) => ({
  code: 'callit' as const,
  label: 'Call-it',
  enabled,
  linked: enabled,
  status: (enabled ? 'available' : 'disabled') as 'available' | 'disabled',
});
