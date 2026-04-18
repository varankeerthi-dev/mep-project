// src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

/**
 * Global React Query Client Configuration
 * 
 * Hybrid refetch strategy:
 * - Tab focus: manual via visibility handler (avoids double refetch)
 * - Navigation: automatic on mount if data is stale (fixes sidebar navigation)
 * - Reconnect: disabled (prevents network spikes)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min - data is "fresh"
      gcTime: 30 * 60 * 1000,          // 30 min - cache retention
      refetchOnWindowFocus: false,    // ✅ Manual via visibility handler
      refetchOnMount: true,             // ✅ CRITICAL FIX - refetch stale data on navigation
      refetchOnReconnect: false,        // ✅ Prevent network spike
      retry: 1,
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

/**
 * Prefetch Utility
 * Use this to prefetch data for routes user is likely to visit
 */
export async function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalidate and Refetch Pattern
 * Use this after mutations to update related queries
 */
export function invalidateAndRefetch(queryKeyPrefix: string[]) {
  queryClient.invalidateQueries({
    queryKey: queryKeyPrefix,
    refetchType: 'active', // Only refetch queries that have active observers
  });
}

/**
 * Clear all cache (use sparingly, e.g., on logout)
 */
export function clearAllCache() {
  queryClient.clear();
}
