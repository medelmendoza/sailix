import { forgetTalaSession } from '@sailix/tala';
import type { Credential } from '@/models/session';

type Member = Pick<Credential, 'tenantId' | 'membershipId'>;

/** The host scope Sailix gives the Tala package for a member. */
export const talaScopeOf = (c: Member) => `org:${c.tenantId}:member:${c.membershipId}`;

/** Sailix signed the member out (or switched organization): their Tala tokens must not stay on the device. */
export const forgetTalaTokens = (c: Member | null | undefined) =>
  c ? forgetTalaSession(talaScopeOf(c)).catch(() => undefined) : Promise.resolve();
