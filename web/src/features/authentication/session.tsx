import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button, ErrorState, SkeletonShell } from '../../components/ui';
import { api, ensureCsrf } from '../../services/api/client';
import { ApiError, describeError, toApiError } from '../../services/api/errors';
import type { Envelope, Me, PlatformAdmin } from '../../services/api/types';

export const TENANT_SESSION = ['session', 'tenant'] as const;
export const PLATFORM_SESSION = ['session', 'platform'] as const;

/** Codes meaning "signed in, but this credential may not use the portal right now". */
const BLOCKING_CODES = [
  'tenant_suspended',
  'membership_suspended',
  'account_suspended',
  'web_access_denied',
];

export function useTenantSessionQuery() {
  return useQuery({
    queryKey: TENANT_SESSION,
    queryFn: async () => (await api.get<Envelope<Me>>('/me')).data.data,
    retry: false,
    staleTime: 60_000,
  });
}

export function usePlatformSessionQuery() {
  return useQuery({
    queryKey: PLATFORM_SESSION,
    queryFn: async () => (await api.get<Envelope<PlatformAdmin>>('/platform/me')).data.data,
    retry: false,
    staleTime: 60_000,
  });
}

const MeContext = createContext<Me | null>(null);
const AdminContext = createContext<PlatformAdmin | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used under <RequireTenant>');
  return me;
}

export function usePlatformAdmin(): PlatformAdmin {
  const admin = useContext(AdminContext);
  if (!admin) throw new Error('usePlatformAdmin must be used under <RequirePlatform>');
  return admin;
}

/** A core feature is on unless the platform switched it off for this organization (the API refuses it too). */
export function hasFeature(me: Me, feature: string): boolean {
  return me.feature_access?.[feature] !== false;
}

/** UI hint only: the API enforces every ability again on each request. */
export function can(me: Me, ability: string): boolean {
  return me.abilities.includes(ability);
}

function BlockedAccess({
  error,
  onLogout,
  loading,
}: {
  error: ApiError;
  onLogout: () => void;
  loading: boolean;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-3 text-xl font-semibold">You cannot use the portal right now</h1>
      <ErrorState message={describeError(error)} />
      <Button className="mt-4" variant="secondary" loading={loading} onClick={onLogout}>
        Sign out
      </Button>
    </main>
  );
}

/**
 * Signed-in area guard of an organization. Anonymous → its sign-in page (`/login`, or the crew's `/portal/login`); blocked
 * credentials get an explanation, never the app.
 */
export function RequireTenant({
  children,
  loginPath = '/login',
}: {
  children?: ReactNode;
  loginPath?: string;
}) {
  const location = useLocation();
  const query = useTenantSessionQuery();
  const logout = useLogout('tenant', loginPath);

  if (query.isPending) return <SkeletonShell />;
  if (query.isError) {
    const error = toApiError(query.error);
    if (error.status === 401)
      return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
    if (BLOCKING_CODES.includes(error.code))
      return (
        <BlockedAccess error={error} onLogout={() => logout.mutate()} loading={logout.isPending} />
      );
    return <ErrorState message={describeError(error)} onRetry={() => void query.refetch()} />;
  }
  return <MeContext.Provider value={query.data}>{children ?? <Outlet />}</MeContext.Provider>;
}

/**
 * Sends a signed-in person to the portal of their own role: administrators to the admin portal, crew to the client portal.
 * Cosmetic like the other route guards: the API refuses what a role may not do.
 */
export function RequireRole({
  role,
  home,
  children,
}: {
  role: 'tenant_admin' | 'crew';
  /** Where the other role belongs. */
  home: string;
  children?: ReactNode;
}) {
  const me = useMe();
  if (me.membership.role !== role) return <Navigate to={home} replace />;
  return children ?? <Outlet />;
}

/** Superadmin area guard. A tenant session is NOT a platform session: it lands on the platform login. */
export function RequirePlatform({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const query = usePlatformSessionQuery();

  if (query.isPending) return <SkeletonShell />;
  if (query.isError) {
    const error = toApiError(query.error);
    if (error.status === 401)
      return <Navigate to="/platform/login" replace state={{ from: location.pathname }} />;
    return <ErrorState message={describeError(error)} onRetry={() => void query.refetch()} />;
  }
  return <AdminContext.Provider value={query.data}>{children ?? <Outlet />}</AdminContext.Provider>;
}

/** Ends the session on the server, then wipes every cached record (one person's data must not outlive their login). */
export function useLogout(kind: 'tenant' | 'platform', loginPath = '/login') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      await api.delete(kind === 'tenant' ? '/auth/session' : '/platform/auth/session');
    },
    onSettled: () => {
      queryClient.clear();
      window.location.assign(kind === 'tenant' ? loginPath : '/platform/login');
    },
  });
}
