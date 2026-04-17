import { useEffect, useRef, useState, useCallback } from 'react';
import { useTabVisibility } from './useTabVisibility';

interface PendingRequest {
  id: string;
  controller: AbortController;
  timestamp: number;
}

interface RequestManagerConfig {
  enabled?: boolean;
  autoCancel?: boolean;
  maxPendingRequests?: number;
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

export function useRequestManager(config: RequestManagerConfig = {}): UseRequestManagerReturn {
  const { 
    enabled = true, 
    autoCancel = true,
    maxPendingRequests = 20,
  } = config;
  
  const { isHidden, isVisible, wasHidden } = useTabVisibility({
    onHidden: () => {
      globalPausedRef.current = true;
      if (autoCancel) {
        cancelAllPending();
      }
    },
    onVisible: () => {
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
      } catch {}
    });
    localRequestsRef.current.clear();
    
    globalPendingRequests.forEach((req) => {
      try {
        req.controller.abort();
      } catch {}
    });
    globalPendingRequests.clear();
    
    updatePendingCount();
  }, [updatePendingCount]);

  const createAbortSignal = useCallback((): AbortSignal => {
    const controller = new AbortController();
    
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
    
    if (globalPendingRequests.size > maxPendingRequests) {
      const oldestId = globalPendingRequests.keys().next().value;
      if (oldestId) {
        const oldest = globalPendingRequests.get(oldestId);
        oldest?.controller.abort();
        globalPendingRequests.delete(oldestId);
      }
    }

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
        } catch {}
      });
      localRequestsRef.current.clear();
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