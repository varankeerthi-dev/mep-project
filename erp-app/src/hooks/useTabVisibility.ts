import { useEffect, useState, useCallback, useRef } from 'react';

export type VisibilityState = 'visible' | 'hidden' | 'prerender' | 'unloaded';

interface UseTabVisibilityOptions {
  onHidden?: () => void;
  onVisible?: () => void;
}

interface UseTabVisibilityReturn {
  isHidden: boolean;
  isVisible: boolean;
  visibilityState: VisibilityState;
  wasHidden: boolean;
  lastHiddenAt: number | null;
}

export function useTabVisibility(options: UseTabVisibilityOptions = {}): UseTabVisibilityReturn {
  const { onHidden, onVisible } = options;
  const [visibilityState, setVisibilityState] = useState<VisibilityState>('visible');
  const [wasHidden, setWasHidden] = useState(false);
  const lastHiddenAtRef = useRef<number | null>(null);
  const previousStateRef = useRef<VisibilityState>('visible');

  const handleVisibilityChange = useCallback(() => {
    const newState = document.visibilityState as VisibilityState;
    const previousState = previousStateRef.current;
    
    setVisibilityState(newState);
    previousStateRef.current = newState;

    if (newState === 'hidden' && previousState !== 'hidden') {
      setWasHidden(true);
      lastHiddenAtRef.current = Date.now();
      onHidden?.();
    } else if (newState === 'visible' && previousState === 'hidden') {
      onVisible?.();
    }
  }, [onHidden, onVisible]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    setVisibilityState(document.visibilityState as VisibilityState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return {
    isHidden: visibilityState === 'hidden',
    isVisible: visibilityState === 'visible',
    visibilityState,
    wasHidden,
    lastHiddenAt: lastHiddenAtRef.current,
  };
}