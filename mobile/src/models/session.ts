import type { z } from 'zod';
import type { credentialMetaSchema, credentialSchema } from '@/schemas/session';

export type CredentialMeta = z.infer<typeof credentialMetaSchema>;
/** The mobile credential: an opaque API token bound to ONE membership (docs/04). */
export type Credential = z.infer<typeof credentialSchema>;
