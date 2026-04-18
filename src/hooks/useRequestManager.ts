import { useEffect, useRef, useState, useCallback } from 'react';
import { useTabVisibility } from './useTabVisibility';

interface PendingRequest {
  id: string;
  controller: AbortController;
  timestamp: number;
}

interface RequestManagerConfig {
  /** Enable/disable the request manager */
  enabled?: boolean;
  /** Maximum pending requests allowed */
  maxPendingRequests?: number;
  /** Debounce delay for visibility changes (ms) */
  visibilityDebounceMs?: number;
}

interface UseRequestManagerReturn {
  isTabActive: boolean;
  isPaused: boolean;
  pendingCount: number;
  abortAll: () => void;
  createAbortSignal: () => AbortSignal;
  withCancellation: <T>(promise: Promise<T>) => Promise<T | undefined>;
}

let globalRequestId = 0;
const globalPendingRequests = new Map<string, PendingRequest>();
const globalPausedRef = { current: false };

/**
 * Request Manager Hook
 * 
 * Manages pending requests with tab visibility awareness.
 * 
 * IMPORTANT: This hook does NOT auto-cancel requests when tab becomes hidden.
 * This was causing data inconsistency issues and page freezing on return.
 * 
 * Instead, it:
 * 1. Tracks pending request count for UI feedback
 * 2. Pauses new request creation when tab is hidden (with debounce)
 * 3. Allows in-flight requests to complete naturally
 * 4. Provides AbortSignal for optional cancellation
 */
export function useRequestManager(config: RequestManagerConfig = {}): UseRequestManagerReturn {
  const {
    enabled = true,
    maxPendingRequests = 50,
    visibilityDebounceMs = 500,
  } = config;

  const visibilityTimeoutRef = useRef<number | null>(null);
  const isHiddenRef = useRef(false);

  const { isVisible } = useTabVisibility({
    onHidden: () => {
      // Debounce visibility changes to prevent rapid toggle issues
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
      visibilityTimeoutRef.current = window.setTimeout(() => {
        isHiddenRef.current = true;
        globalPausedRef.current = true;
      }, visibilityDebounceMs);
    },
    onVisible: () => {
      // Clear pending hide timeout
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
      }
      isHiddenRef.current = false;
      globalPausedRef.current = false;
    },
  });

  const [pendingCount, setPendingCount] = useState(0);
  const localRequestsRef = useRef<Map<string, PendingRequest>>(new Map());

  const updatePendingCount = useCallback(() => {
    const total = globalPendingRequests.size + localRequestsRef.current.size;
    setPendingCount(total);
  }, []);

  const cancelAllPending = useCallback(() => {
    localRequestsRef.current.forEach((req) => {
      try {
        req.controller.abort();
      } catch {
        // Ignore already aborted controllers
      }
    });
    localRequestsRef.current.clear();

    globalPendingRequests.forEach((req) => {
      try {
        req.controller.abort();
      } catch {
        // Ignore already aborted controllers
      }
    });
    globalPendingRequests.clear();

    updatePendingCount();
  }, [updatePendingCount]);

  /**
   * Create an AbortSignal for a new request
   * Returns an already-aborted signal if tab is paused
   */
  const createAbortSignal = useCallback((): AbortSignal => {
    const controller = new AbortController();

    // If disabled or tab is paused, return aborted signal
    // This allows queries to skip execution rather than fail
    if (!enabled || globalPausedRef.current) {
      controller.abort();
      return controller.signal;
    }

    const id = `req_${++globalRequestId}`;
    const pending: PendingRequest = {
      id,
      controller,
      timestamp: Date.now(),
    };

    globalPendingRequests.set(id, pending);
    localRequestsRef.current.set(id, pending);

    // Limit pending requests to prevent memory leaks
    if (globalPendingRequests.size > maxPendingRequests) {
      const oldestId = globalPendingRequests.keys().next().value;
      if (oldestId) {
        const oldest = globalPendingRequests.get(oldestId);
        oldest?.controller.abort();
        globalPendingRequests.delete(oldestId);
      }
    }

    // Override abort to clean up our tracking
    const originalAbort = controller.abort.bind(controller);
    controller.abort = () => {
      originalAbort();
      globalPendingRequests.delete(id);
      localRequestsRef.current.delete(id);
      updatePendingCount();
    };

    updatePendingCount();
    return controller.signal;
  }, [enabled, maxPendingRequests, updatePendingCount]);

  /**
   * Execute a promise with optional cancellation support
   * Returns undefined if cancelled, otherwise returns the result
   */
  const withCancellation = useCallback(async <T,>(promise: Promise<T>): Promise<T | undefined> => {
    if (!enabled || globalPausedRef.current) {
      return undefined;
    }

    const signal = createAbortSignal();

    try {
      const result = await promise;
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return undefined;
      }
      throw error;
    } finally {
      updatePendingCount();
    }
  }, [enabled, createAbortSignal, updatePendingCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localRequestsRef.current.forEach((req) => {
        try {
          req.controller.abort();
        } catch {
          // Ignore
        }
      });
      localRequestsRef.current.clear();

      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTabActive: isVisible,
    isPaused: !isVisible,
    pendingCount,
    abortAll: cancelAllPending,
    createAbortSignal,
    withCancellation,
  };
}

/**
 * Get global pending request count
 * Useful for showing loading indicators
 */
export function getGlobalPendingCount(): number {
  return globalPendingRequests.size;
}

/**
 * Cancel all pending requests globally
 * Use when switching pages or logging out
 */
export function cancelAllGlobalRequests() {
  globalPendingRequests.forEach((req) => {
    try {
      req.controller.abort();
    } catch {
      // Ignore
    }
  });
  globalPendingRequests.clear();
}
