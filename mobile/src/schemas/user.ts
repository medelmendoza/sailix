import { z } from 'zod';

/** Profile as persisted locally (already normalised from `GET /user/{id}`). */
export const userProfileSchema = z.object({
  userId: z.string().min(1),
  crewId: z.string().min(1),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
  fullName: z.string(),
  email: z.string(),
  mobile: z.string(),
  birthDate: z.string(),
  clientCode: z.string(),
});

export const sessionSchema = z.object({
  token: z.string().min(1),
  user: userProfileSchema,
});
