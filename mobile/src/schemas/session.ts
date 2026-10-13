import { z } from 'zod';

/** What is persisted next to the token (non-secret metadata). */
export const credentialMetaSchema = z.object({
  expiresAt: z.string().nullable(),
  membershipId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantCode: z.string().min(1),
});

export const credentialSchema = credentialMetaSchema.extend({ token: z.string().min(1) });
