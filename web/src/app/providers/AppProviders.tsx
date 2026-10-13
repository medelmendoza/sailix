import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PLATFORM_SESSION, TENANT_SESSION } from '../../features/authentication/session';
import { setUnauthorizedHandler } from '../../services/api/client';
import { ApiError } from '../../services/api/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) are answers, not outages: do not hammer the API with retries.
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());

  // A 401 on any authenticated call means the session ended: drop every cached record and re-check the
  // session so the route guards send the user to the right sign-in page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      void queryClient.invalidateQueries({ queryKey: TENANT_SESSION });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_SESSION });
    });
    return () => setUnauthorizedHandler(undefined);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
