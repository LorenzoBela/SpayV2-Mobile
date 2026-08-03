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
    },
  },
});
