import { createContext, useContext, ReactNode, useMemo, useCallback, useRef, useEffect } from 'react';
import { usePresence, PresenceStatus } from './usePresence';
import { useTabFocus } from './useTabFocus';

interface PresenceContextValue {
  status: PresenceStatus;
  isActive: boolean;
  isIdle: boolean;
  isVisible: boolean;
  isFocused: boolean;
  hasFocus: boolean;
  shouldPause: boolean;
  shouldResume: boolean;
  onPause: (callback: () => void) => () => void;
  onResume: (callback: () => void) => () => void;
}

interface PresenceProviderProps {
  children: ReactNode;
  idleTimeout?: number;
  throttleMs?: number;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresenceContext(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresenceContext must be used within PresenceProvider');
  }
  return context;
}

export function PresenceProvider({ children, idleTimeout = 30000, throttleMs = 1000 }: PresenceProviderProps) {
  const { status, isActive, isIdle } = usePresence({ idleTimeout, throttleMs });
  const { isVisible, isFocused, hasFocus } = useTabFocus();
  
  const pauseCallbacksRef = useRef<Set<() => void>>(new Set());
  const resumeCallbacksRef = useRef<Set<() => void>>(new Set());
  const wasPausedRef = useRef<boolean>(false);

  const shouldPause = !isVisible || isIdle;
  const shouldResume = isVisible && !wasPausedRef.current;

  const onPause = useCallback((callback: () => void) => {
    pauseCallbacksRef.current.add(callback);
    return () => {
      pauseCallbacksRef.current.delete(callback);
    };
  }, []);

  const onResume = useCallback((callback: () => void) => {
    resumeCallbacksRef.current.add(callback);
    return () => {
      resumeCallbacksRef.current.delete(callback);
    };
  }, []);

  // Handle pause/resume callbacks when visibility or presence changes
  useEffect(() => {
    if (shouldPause && !wasPausedRef.current) {
      wasPausedRef.current = true;
      pauseCallbacksRef.current.forEach(cb => cb());
    } else if (shouldResume) {
      wasPausedRef.current = false;
      resumeCallbacksRef.current.forEach(cb => cb());
    }
  }, [shouldPause, shouldResume]);

  const value = useMemo<PresenceContextValue>(() => ({
    status,
    isActive,
    isIdle,
    isVisible,
    isFocused,
    hasFocus,
    shouldPause,
    shouldResume,
    onPause,
    onResume,
  }), [
    status,
    isActive,
    isIdle,
    isVisible,
    isFocused,
    hasFocus,
    shouldPause,
    shouldResume,
    onPause,
    onResume,
  ]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}