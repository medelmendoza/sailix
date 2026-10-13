import Constants from 'expo-constants';
import { z } from 'zod';

/** Addresses that only work on a developer machine: a shipped build pointing at one is a mistake, not a configuration. */
export function isLocalHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

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
  })
  .refine((v) => v.appEnv === 'development' || !isLocalHost(v.apiBaseUrl), {
    path: ['apiBaseUrl'],
    message: 'staging and production builds cannot point at a local or private-network address',
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(extra: unknown): Env {
  const parsed = envSchema.parse(extra);
  return { ...parsed, demo: parsed.appEnv === 'production' ? false : parsed.demo };
}

/** Validated at startup so a bad build profile fails loudly instead of at the first request. */
export const env: Env = parseEnv(Constants.expoConfig?.extra);
