import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUrlSlug, apexHosts, expectsOrganization, storedSlug, tenantHeaders } from './address';

function openAt(path: string) {
  window.history.replaceState(null, '', path);
}

describe('organization address', () => {
  beforeEach(() => {
    localStorage.clear();
    openAt('/login');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('reads ?tenant=<slug>, remembers it and takes it out of the address bar', () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    openAt('/login?tenant=Tenant1&keep=1');

    expect(applyUrlSlug()).toBe(true);
    expect(storedSlug()).toBe('tenant1');
    expect(window.location.search).toBe('?keep=1'); // only the switcher's own parameter is removed
    expect(tenantHeaders()['X-Tenant-Slug']).toBe('tenant1');
  });

  it('forgets the choice with ?tenant=reset', () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    openAt('/login?tenant=tenant1');
    applyUrlSlug();
    openAt('/login?tenant=reset');

    expect(applyUrlSlug()).toBe(true);
    expect(storedSlug()).toBeNull();
    expect(tenantHeaders()).not.toHaveProperty('X-Tenant-Slug');
  });

  it('ignores anything that does not look like a slug', () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    for (const bad of ['a', "x'; drop", '-bad-', 'a b', '../etc', '<script>']) {
      openAt(`/login?tenant=${encodeURIComponent(bad)}`);
      applyUrlSlug();
      expect(storedSlug()).toBeNull();
    }
  });

  it('does nothing unless the switcher is built in', () => {
    openAt('/login?tenant=tenant1');
    expect(applyUrlSlug()).toBe(false);
    expect(storedSlug()).toBeNull();
    expect(window.location.search).toBe('?tenant=tenant1'); // untouched
    expect(tenantHeaders()).not.toHaveProperty('X-Tenant-Slug');
  });

  it('a stored value that is not a slug is not used', () => {
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    localStorage.setItem('sailix.tenant_slug', 'NOT A SLUG');
    expect(storedSlug()).toBeNull();
  });

  it('always says which host the page is on', () => {
    expect(tenantHeaders()['X-Tenant-Host']).toBe('localhost');
  });

  it('expects an organization on any host except the shared sign-in hosts', () => {
    expect(apexHosts()).toEqual(['localhost', '127.0.0.1']);
    expect(expectsOrganization()).toBe(false);

    vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'sailix.com');
    expect(expectsOrganization()).toBe(true); // localhost is now somebody's address

    vi.stubEnv('VITE_TENANT_APEX_HOSTS', 'localhost');
    vi.stubEnv('VITE_TENANT_SLUG_SWITCH', 'true');
    localStorage.setItem('sailix.tenant_slug', 'tenant1');
    expect(expectsOrganization()).toBe(true); // a chosen slug counts too
  });
});
