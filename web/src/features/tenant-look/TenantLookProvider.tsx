import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { api } from '../../services/api/client';
import { ApiError } from '../../services/api/errors';
import type { PublicTenant } from '../../services/api/types';
import {
  applyUrlSlug,
  expectsOrganization,
  setStoredSlug,
  slugSwitchEnabled,
  storedSlug,
} from './address';
import { applyLook, cacheLook, cachedLook } from './look';

type State = { look: PublicTenant | null };
const LookContext = createContext<State>({ look: null });

/** The organization this address names (its name and look), or null on the shared sign-in. */
export const useTenantLook = (): PublicTenant | null => useContext(LookContext).look;

export const TENANT_LOOK_KEY = ['tenant-look'] as const;

/** Layout for every organization-facing page: finds out whose address this is and puts its look on the page. */
export function TenantLookLayout() {
  return (
    <TenantLookProvider>
      <Outlet />
    </TenantLookProvider>
  );
}

export function TenantLookProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // `?tenant=<slug>` (shared-address demos) is read once, before the first request goes out
  const [switched] = useState(() => applyUrlSlug());
  useEffect(() => {
    if (switched) void queryClient.clear();
  }, [switched, queryClient]);

  const slug = storedSlug();
  const expects = expectsOrganization();
  const query = useQuery({
    queryKey: [...TENANT_LOOK_KEY, slug],
    queryFn: async () => (await api.get<{ data: PublicTenant }>('/public/tenant')).data.data,
    retry: false,
    staleTime: 60_000,
  });

  const failure = query.error instanceof ApiError ? query.error : null;
  const look = query.data ?? (query.isPending ? cachedLook(slug) : null);

  useEffect(() => {
    if (query.data) cacheLook(slug, query.data);
    else if (failure) cacheLook(slug, null);
  }, [query.data, failure, slug]);
  useEffect(() => {
    applyLook(look);
    return () => applyLook(null);
  }, [look]);

  const value = useMemo(() => ({ look }), [look]);

  if (failure?.status === 403)
    return <Unavailable text="This organization is not available right now." slug={slug} />;
  if (failure?.status === 404 && expects)
    return <Unavailable text="No organization is set up at this address." slug={slug} />;
  if (query.isPending && expects && !look) return <Spinner label="Loading" />;

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

/** Shown when the address names no open organization. With the shared-address switcher on, it offers a way out. */
function Unavailable({ text, slug }: { text: string; slug: string | null }) {
  const [typed, setTyped] = useState('');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent-600">Sailix</p>
      <h1 className="mt-1 text-xl font-semibold text-brand-800">{text}</h1>
      <p className="mt-2 text-sm text-muted">
        Check the address, or ask your administrator for the right one.
      </p>
      {slugSwitchEnabled() ? (
        <form
          className="mt-6 flex flex-col gap-2 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            setStoredSlug(typed.trim().toLowerCase() || null);
            window.location.reload();
          }}
        >
          <label htmlFor="demo-slug" className="text-sm font-medium">
            Organization code {slug ? `(now: ${slug})` : ''}
          </label>
          <input
            id="demo-slug"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="min-h-10 rounded-md border border-line px-3 text-sm"
          />
          <button
            type="submit"
            className="min-h-10 rounded-md bg-brand-700 px-4 text-sm font-medium text-white"
          >
            Open
          </button>
        </form>
      ) : null}
    </main>
  );
}
