import { useEffect, useRef, useCallback } from 'react';
import { usePresenceContext } from './PresenceContext';

interface UsePresenceAwareOptions {
  autoPause?: boolean;
  autoResume?: boolean;
  pollingInterval?: number;
}

interface UsePresenceAwareReturn {
  isPaused: boolean;
  startPolling: (callback: () => void | Promise<void>, interval?: number) => () => void;
  stopPolling: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
}

export function usePresenceAware(options: UsePresenceAwareOptions = {}): UsePresenceAwareReturn {
  const { autoPause = true, autoResume = true, pollingInterval = 5000 } = options;
  const { shouldPause, shouldResume, onPause, onResume, isVisible, isIdle, status } = usePresenceContext();
  
  const isPausedRef = useRef<boolean>(false);
  const pollingRef = useRef<number | null>(null);
  const pollingCallbackRef = useRef<() => void | Promise<void> | null>(null);

  const pauseExecution = useCallback(() => {
    isPausedRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const resumeExecution = useCallback(() => {
    isPausedRef.current = false;
    if (pollingCallbackRef.current) {
      pollingRef.current = window.setInterval(() => {
        pollingCallbackRef.current?.();
      }, pollingInterval);
    }
  }, [pollingInterval]);

  const startPolling = useCallback((callback: () => void | Promise<void>, interval: number = pollingInterval) => {
    pollingCallbackRef.current = callback;
    
    if (!isPausedRef.current) {
      pollingRef.current = window.setInterval(() => {
        callback();
      }, interval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      pollingCallbackRef.current = null;
    };
  }, [pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingCallbackRef.current = null;
  }, []);

  // Register automatic pause/resume when tab visibility or idle status changes
  useEffect(() => {
    if (autoPause && shouldPause) {
      isPausedRef.current = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } else if (autoResume && shouldResume && !isPausedRef.current) {
      if (pollingCallbackRef.current && !pollingRef.current) {
        pollingRef.current = window.setInterval(() => {
          pollingCallbackRef.current?.();
        }, pollingInterval);
      }
    }
  }, [shouldPause, shouldResume, autoPause, autoResume, pollingInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    isPaused: isPausedRef.current || !isVisible || isIdle,
    startPolling,
    stopPolling,
    pauseExecution,
    resumeExecution,
  };
}