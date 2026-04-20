// src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Global React Query Client Configuration optimized for 60+ pages.
 * 
 * Performance Strategy:
 * - Tab focus: Disabled to prevent UI freezing on return.
 * - Mount: ENABLED to refetch stale data on navigation (keeps data fresh).
 * - StaleTime: 5 mins to balance freshness with performance.
 * 
 * Session Management:
 * - Proactively refreshes session before queries if expired
 * - Prevents "infinite spinner" when returning after long inactivity
 */

// Track last session refresh to avoid spam
let lastSessionRefresh = 0;
let sessionRefreshPromise: Promise<boolean> | null = null;

/**
 * Ensure Supabase session is valid before making requests.
 * This runs BEFORE queries fire, not after they fail.
 */
export async function ensureValidSession(): Promise<boolean> {
  const now = Date.now();
  
  // If we refreshed in the last 10 seconds, assume it's still valid
  // Reduced from 30s to 10s for more aggressive session checking
  if (now - lastSessionRefresh < 10000) {
    return true;
  }
  
  // If already refreshing, wait for that
  if (sessionRefreshPromise) {
    return sessionRefreshPromise;
  }
  
  sessionRefreshPromise = (async () => {
    try {
      console.log('🔄 Checking/refreshing session...');
      
      // Try to get current session first
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        // Check if token is about to expire (within next 5 minutes)
        const expiresAt = currentSession.expires_at || 0;
        const expiresIn = expiresAt - (Date.now() / 1000);
        
        if (expiresIn > 300) {
          // Token is still valid for >5 min, no need to refresh
          console.log('✅ Session still valid');
          lastSessionRefresh = now;
          return true;
        }
      }
      
      // Token expired or expiring soon - refresh it
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Session refresh failed:', error.message);
        
        // Check if it's a terminal error (refresh token expired)
        if (error.message?.includes('refresh_token_not_found') || 
            error.message?.includes('invalid_grant')) {
          return false;
        }
        
        // Other errors might be transient, assume session might still work
        return !!currentSession;
      }
      
      if (session) {
        console.log('✅ Session refreshed successfully');
        lastSessionRefresh = now;
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('❌ Session check error:', err);
      return false;
    } finally {
      sessionRefreshPromise = null;
    }
  })();
  
  return sessionRefreshPromise;
}

/**
 * Wrap query functions to ensure session is valid before executing
 */
export function withSessionCheck<T, Args extends any[] = []>(
  queryFn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    // Check session BEFORE running the query
    const sessionValid = await ensureValidSession();
    
    if (!sessionValid) {
      throw new Error('SESSION_EXPIRED');
    }
    
    // Session is valid, run the actual query
    return queryFn(...args);
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays "fresh" for 5 minutes
      staleTime: 5 * 60 * 1000,
      
      // Keep data in cache for 30 minutes after last use
      gcTime: 30 * 60 * 1000,
      
      // CRITICAL: Prevent tab-switch query storm
      refetchOnWindowFocus: false,
      
      // CRITICAL: Refetch stale data on navigation
      refetchOnMount: true,
      
      // Prevent network spikes on reconnect
      refetchOnReconnect: false,
      
      // Simple retry - session check happens BEFORE query, not after
      retry: (failureCount, error: any) => {
        // Don't retry if session expired
        if (error?.message === 'SESSION_EXPIRED') {
          return false;
        }
        // Retry other errors once
        return failureCount < 1;
      },
      
      retryDelay: (attemptIndex) => {
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      
      networkMode: 'online',
    },
    mutations: {
      // Mutations also get session check via withSessionCheck wrapper
      retry: false,
      networkMode: 'online',
    },
  },
});

/**
 * Prefetch Utility
 */
export async function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: withSessionCheck(queryFn),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalidate Pattern
 */
export function invalidateAndRefetch(queryKeyPrefix: string[]) {
  queryClient.invalidateQueries({
    queryKey: queryKeyPrefix,
    refetchType: 'active',
  });
}

/**
 * Clear Cache
 */
export function clearAllCache() {
  queryClient.clear();
}

/**
 * Exported for visibility handler in App.tsx
 */
export const refreshSessionIfNeeded = ensureValidSession;
