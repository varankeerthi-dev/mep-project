// src/queryClient.ts
import { QueryClient, hashQueryKey } from '@tanstack/react-query';

/**
 * Global React Query Client Configuration
 * 
 * Optimized for MEP Construction Management System:
 * - staleTime: 5min → Data served instantly from cache, no loading spinner
 * - gcTime: 10min → Balance between memory and freshness (reduced from 30min)
 * - refetchOnWindowFocus: false → Prevent query storms on tab return
 * - refetchOnMount: 'ifStale' → Only refetch stale data on mount
 * 
 * Tab Return Strategy:
 * - User returns to tab → sees cached data immediately
 * - Background refetch happens only for stale queries
 * - Request manager does NOT cancel in-flight requests
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min - data stays fresh in cache
      gcTime: 10 * 60 * 1000,           // 10 min - reduced for fresher data on return
      refetchOnWindowFocus: false,       // ✅ CRITICAL: Prevent query storm on tab return
      refetchOnMount: 'ifStale',         // ✅ Refetch only if stale (improved from false)
      refetchOnReconnect: false,         // ✅ Prevent storm on network recovery
      retry: 1,                          // Single retry for transient failures
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
  options?: { staleTime?: number }
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
  });
}

/**
 * Prefetch Multiple Queries in Parallel
 */
export async function prefetchQueries(
  queries: Array<{
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    staleTime?: number;
  }>
) {
  await Promise.all(
    queries.map((q) =>
      prefetchQuery(q.queryKey, q.queryFn, { staleTime: q.staleTime })
    )
  );
}

/**
 * Invalidate and Refetch Pattern
 * Use this after mutations to update related queries
 */
export function invalidateAndRefetch(queryKeyPrefix: unknown[]) {
  queryClient.invalidateQueries({
    queryKey: queryKeyPrefix,
    refetchType: 'active', // Only refetch queries that have active observers
  });
}

/**
 * Cancel All Queries
 * Use when user logs out or switches organization
 */
export function cancelAllQueries() {
  queryClient.cancelQueries();
}

/**
 * Clear all cache (use sparingly, e.g., on logout)
 */
export function clearAllCache() {
  queryClient.clear();
}

/**
 * Set Query Data with Organization Scope
 * Helper to update cached data with org-aware keys
 */
export function setQueryDataWithOrg<T>(
  queryKey: string,
  orgId: string | undefined,
  updater: T | ((old: T | undefined) => T)
) {
  if (!orgId) return;
  queryClient.setQueryData([queryKey, orgId], updater);
}

/**
 * Get Query Data with Organization Scope
 */
export function getQueryDataWithOrg<T>(
  queryKey: string,
  orgId: string | undefined
): T | undefined {
  if (!orgId) return undefined;
  return queryClient.getQueryData<T>([queryKey, orgId]);
}
