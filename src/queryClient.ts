// src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Global React Query Client Configuration optimized for 60+ pages.
 */

let lastSessionRefresh = 0;
let sessionRefreshPromise: Promise<boolean> | null = null;

type SessionCheckOptions = {
  timeoutMs?: number;
  strict?: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout while ${label}`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

/**
 * Ensure Supabase session is valid before making requests.
 * In non-strict mode, timeout errors do not block user actions.
 */
export async function ensureValidSession(options: SessionCheckOptions = {}): Promise<boolean> {
  const { timeoutMs = 8000, strict = false } = options;
  const now = Date.now();

  if (now - lastSessionRefresh < 10000) {
    return true;
  }

  if (sessionRefreshPromise) {
    return sessionRefreshPromise;
  }

  sessionRefreshPromise = (async () => {
    try {
      const { data: { session: currentSession } } = await withTimeout(
        supabase.auth.getSession(),
        timeoutMs,
        'getting auth session'
      );

      if (currentSession) {
        const expiresAt = currentSession.expires_at || 0;
        const expiresIn = expiresAt - (Date.now() / 1000);

        if (expiresIn > 300) {
          lastSessionRefresh = now;
          return true;
        }
      }

      const { data: { session }, error } = await withTimeout(
        supabase.auth.refreshSession(),
        timeoutMs,
        'refreshing auth session'
      );

      if (error) {
        const message = error.message || '';
        const terminal = message.includes('refresh_token_not_found') || message.includes('invalid_grant');
        if (terminal) return false;
        if (!strict) {
          lastSessionRefresh = now;
          return true;
        }
        return !!currentSession;
      }

      if (session) {
        lastSessionRefresh = now;
        return true;
      }

      return false;
    } catch (err) {
      const message = (err as any)?.message || String(err || '');
      const timeoutHit = message.includes('Timeout while');

      if (timeoutHit && !strict) {
        // Avoid global app freeze behavior on tab wake-up latency.
        lastSessionRefresh = now;
        return true;
      }

      return false;
    } finally {
      sessionRefreshPromise = null;
    }
  })();

  return sessionRefreshPromise;
}

/**
 * Wrap query functions to ensure session is valid before executing.
 */
export function withSessionCheck<T, Args extends any[] = []>(
  queryFn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    const sessionValid = await ensureValidSession({ strict: false });

    if (!sessionValid) {
      throw new Error('SESSION_EXPIRED');
    }

    return queryFn(...args);
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        if (error?.message === 'SESSION_EXPIRED') {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'online',
    },
    mutations: {
      retry: false,
      networkMode: 'online',
    },
  },
});

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

export function invalidateAndRefetch(queryKeyPrefix: string[]) {
  queryClient.invalidateQueries({
    queryKey: queryKeyPrefix,
    refetchType: 'active',
  });
}

export function clearAllCache() {
  queryClient.clear();
}

export const refreshSessionIfNeeded = ensureValidSession;
