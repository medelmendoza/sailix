import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // One retry for transient failures only; never retry auth/validation errors.
      retry: (failureCount, error) =>
        failureCount < 1 && error instanceof ApiError && error.kind === 'network',
    },
  },
});
