import { useEffect, useRef, useCallback, useState } from 'react';

interface AsyncIntervalConfig {
  interval: number;
  enabled?: boolean;
  immediate?: boolean;
}

interface UseAsyncIntervalReturn {
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  flush: () => Promise<void>;
  error: Error | null;
}

export function useAsyncInterval<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void | Promise<void>,
  config: AsyncIntervalConfig
): UseAsyncIntervalReturn {
  const { interval, enabled = true, immediate = true } = config;
  
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  const intervalRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const flagsRef = useRef({
    isPaused: false,
    isTabHidden: false,
  });

  // Check if we should be running based on external pause state
  const shouldRun = useCallback(() => {
    return enabled && !flagsRef.current.isPaused && !flagsRef.current.isTabHidden;
  }, [enabled]);

  const execute = useCallback(async () => {
    if (!shouldRun()) {
      stop();
      return;
    }
    
    try {
      await callbackRef.current();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Interval error'));
    }
  }, [shouldRun]);

  const start = useCallback(() => {
    if (intervalRef.current || !enabled) return;
    
    isRunningRef.current = true;
    setIsRunning(true);
    
    intervalRef.current = window.setInterval(execute, interval);
    
    if (immediate) {
      execute();
    }
  }, [enabled, interval, execute, immediate]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isRunningRef.current = false;
    setIsRunning(false);
  }, []);

  const flush = useCallback(async () => {
    await execute();
  }, [execute]);

  // Provide methods to control pause state externally
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isRunning,
    start,
    stop,
    flush,
    error,
  };
}

// Utility function to create a polling wrapper that respects tab visibility
// Call this in your component with the tab visibility state

export function createVisibilityAwarePoller(
  intervalMs: number,
  onHidden?: () => void,
  onVisible?: () => void
) {
  let intervalId: number | null = null;
  let callback: (() => void | Promise<void>) | null = null;
  let isTabHidden = false;

  return {
    start(cb: () => void | Promise<void>) {
      callback = cb;
      if (intervalId) return;
      
      intervalId = window.setInterval(() => {
        if (!isTabHidden && callback) {
          callback();
        }
      }, intervalMs);
    },
    
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      callback = null;
    },
    
    pause() {
      isTabHidden = true;
      onHidden?.();
    },
    
    resume() {
      isTabHidden = false;
      onVisible?.();
    },
    
    isActive() {
      return intervalId !== null;
    },
  };
}