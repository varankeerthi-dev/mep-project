import { createContext, useContext, useMemo, ReactNode, useCallback, useRef, useEffect } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useRequestManager } from './useRequestManager';

interface TabActivityState {
  isActive: boolean;
  isHidden: boolean;
  isPaused: boolean;
  pendingRequestCount: number;
}

interface TabActivityActions {
  abortAllRequests: () => void;
  createAbortSignal: () => AbortSignal;
  withCancellation: <T>(promise: Promise<T>) => Promise<T | undefined>; 
}

interface TabActivityContextValue extends TabActivityState, TabActivityActions {}

const TabActivityContext = createContext<TabActivityContextValue | null>(null);

export function useTabActivity(): TabActivityContextValue {
  const context = useContext(TabActivityContext);
  if (!context) {
    throw new Error('useTabActivity must be used within TabActivityProvider');
  }
  return context;
}

interface TabActivityProviderProps {
  children: ReactNode;
  autoCancelRequests?: boolean;
  maxPendingRequests?: number;
  onTabHidden?: () => void;
  onTabVisible?: () => void;
}

export function TabActivityProvider({
  children,
  autoCancelRequests = true,
  maxPendingRequests = 20,
  onTabHidden,
  onTabVisible,
}: TabActivityProviderProps) {
  const { isHidden, isVisible, wasHidden, lastHiddenAt } = useTabVisibility({
    onHidden: onTabHidden,
    onVisible: onTabVisible,
  });

  const { 
    isTabActive, 
    isPaused, 
    pendingCount, 
    abortAll, 
    createAbortSignal, 
    withCancellation 
  } = useRequestManager({
    enabled: true,
    autoCancel: autoCancelRequests,
    maxPendingRequests,
  });

  const value = useMemo<TabActivityContextValue>(() => ({
    isActive: isTabActive,
    isHidden,
    isPaused,
    pendingRequestCount: pendingCount,
    abortAllRequests: abortAll,
    createAbortSignal,
    withCancellation,
  }), [
    isTabActive,
    isHidden,
    isPaused,
    pendingCount,
    abortAll,
    createAbortSignal,
    withCancellation,
  ]);

  return (
    <TabActivityContext.Provider value={value}>
      {children}
    </TabActivityContext.Provider>
  );
}