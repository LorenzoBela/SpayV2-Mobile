import { QueryClient } from '@tanstack/react-query';

// Centralized QueryClient instance to prevent circular imports and enable cache reads
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours cache retention/garbage collection time
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      // Four 10s attempts plus backoff can hide a network failure for ~47s.
      // Retry a transient read once; permission/session errors need user action.
      retry: (failureCount, error: any) => {
        const status = error?.data?.httpStatus ?? error?.status;
        return failureCount < 1 && status !== 401 && status !== 403;
      },
    },
  },
});
