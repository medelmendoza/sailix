import type { z } from 'zod';
import type { sessionSchema, userProfileSchema } from '@/schemas/user';

export type UserProfile = z.infer<typeof userProfileSchema>;
export type Session = z.infer<typeof sessionSchema>;
