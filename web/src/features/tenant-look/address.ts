/**
 * Which organization this browser tab is talking about. The server decides from the page's host (and from the
 * optional shared-address slug below). Nothing here is trusted for anything else, and it grants no access.
 */
const SLUG_KEY = 'sailix.tenant_slug';
export const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Hosts that are the shared sign-in (no organization in the address). Everything else is expected to be an organization. */
export const apexHosts = (): string[] =>
  String(import.meta.env.VITE_TENANT_APEX_HOSTS ?? 'localhost,127.0.0.1')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

/** Shared-address demos: `?tenant=<slug>` picks the organization. Built in only when asked for (never in production). */
export const slugSwitchEnabled = (): boolean => import.meta.env.VITE_TENANT_SLUG_SWITCH === 'true';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback; // storage can be blocked: the app works without it
  }
}

export function storedSlug(): string | null {
  if (!slugSwitchEnabled()) return null;
  const v = safe(() => localStorage.getItem(SLUG_KEY), null);
  return v && SLUG_SHAPE.test(v) ? v : null;
}

export function setStoredSlug(slug: string | null): void {
  safe(
    () => (slug ? localStorage.setItem(SLUG_KEY, slug) : localStorage.removeItem(SLUG_KEY)),
    undefined,
  );
}

/**
 * Reads `?tenant=<slug>` from the address, remembers it and removes it from the URL. `?tenant=reset` forgets the choice.
 * Returns true when the choice changed (so anything cached for the old organization can be dropped).
 */
export function applyUrlSlug(): boolean {
  if (!slugSwitchEnabled() || typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const wanted = url.searchParams.get('tenant');
  if (wanted === null) return false;

  const slug = wanted.trim().toLowerCase();
  const before = storedSlug();
  if (slug === 'reset') setStoredSlug(null);
  else if (SLUG_SHAPE.test(slug)) setStoredSlug(slug);
  url.searchParams.delete('tenant');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return before !== storedSlug();
}

/** Do we expect this page to be one organization's own address (and so to show its name and look)? */
export function expectsOrganization(): boolean {
  if (typeof window === 'undefined') return false;
  return storedSlug() !== null || !apexHosts().includes(window.location.hostname.toLowerCase());
}

/** What the API needs to know to find the organization. Routing only: the credential still decides access. */
export function tenantHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') headers['X-Tenant-Host'] = window.location.hostname;
  const slug = storedSlug();
  if (slug) headers['X-Tenant-Slug'] = slug;
  return headers;
}
