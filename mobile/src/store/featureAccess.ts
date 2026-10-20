import { useSessionStore } from './sessionStore';

/** The core features the platform can switch off for an organization. */
export type FeatureCode =
  'crew' | 'documents' | 'announcements' | 'finance' | 'feedback' | 'todos' | 'branding';

/**
 * Whether a core feature is on for the signed-in organization. A feature is on unless the platform switched it off;
 * the server refuses it as well, so this only decides what the app shows.
 */
export function useFeature(code: FeatureCode): boolean {
  return useSessionStore((s) => s.me?.feature_access?.[code] !== false);
}
