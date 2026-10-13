import Constants from 'expo-constants';
import { z } from 'zod';

const envSchema = z
  .object({
    appEnv: z.enum(['development', 'staging', 'production']),
    apiBaseUrl: z.url(),
    apiPrefix: z.string().startsWith('/'),
    privacyUrl: z.url(),
    /** Build-time switch for the scripted sample-data demo; ignored (always false) in production builds. */
    demo: z.boolean().default(false),
  })
  // Credentials and tokens must never travel over plain HTTP in a shipped build (SR-04).
  .refine((v) => v.appEnv === 'development' || v.apiBaseUrl.startsWith('https://'), {
    path: ['apiBaseUrl'],
    message: 'staging and production builds require an https:// API address',
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(extra: unknown): Env {
  const parsed = envSchema.parse(extra);
  return { ...parsed, demo: parsed.appEnv === 'production' ? false : parsed.demo };
}

/** Validated at startup so a bad build profile fails loudly instead of at the first request. */
export const env: Env = parseEnv(Constants.expoConfig?.extra);
