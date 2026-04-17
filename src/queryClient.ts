// src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

/**
 * Global React Query Client Configuration
 * 
 * How tab-return works (ZohoBooks-style):
 * - staleTime: 5min → Data served instantly from cache, no loading spinner
 * - refetchOnWindowFocus: 'always' → Background refetch when tab regains focus (only for stale data)
 * - refetchOnMount: true → Refetch stale data when component mounts
 * - gcTime: 30min → Cache survives long tab-away periods (no blank pages)
 * 
 * Flow: User returns to tab → sees cached data immediately → fresh data swaps in 2-5s background
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: (query) => {
        const { dataUpdatedAt } = query.state;
        const howOldIsData = Date.now() - dataUpdatedAt;
        return howOldIsData > 10 * 60 * 1000;
      },
      retry: 1,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
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
