import Constants from 'expo-constants';
import { z } from 'zod';

const envSchema = z.object({
  appEnv: z.enum(['development', 'staging', 'production']),
  apiBaseUrl: z.url(),
  apiPrefix: z.string().startsWith('/'),
  privacyUrl: z.url(),
  servicesEnabled: z.boolean(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(extra: unknown): Env {
  return envSchema.parse(extra);
}

/** Validated at startup so a bad build profile fails loudly instead of at the first request. */
export const env: Env = parseEnv(Constants.expoConfig?.extra);
