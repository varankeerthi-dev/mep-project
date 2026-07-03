import { useEffect, useRef, useState, useCallback } from 'react';

export type PresenceStatus = 'active' | 'idle';

interface UsePresenceOptions {
  idleTimeout?: number;
  throttleMs?: number;
}

interface UsePresenceReturn {
  status: PresenceStatus;
  isActive: boolean;
  isIdle: boolean;
}

export function usePresence(options: UsePresenceOptions = {}): UsePresenceReturn {
  const { idleTimeout = 30000, throttleMs = 1000 } = options;
  const [status, setStatus] = useState<PresenceStatus>('active');
  const lastActivityRef = useRef<number>(Date.now());
  const throttledRef = useRef<boolean>(false);
  const idleCheckRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateActivity = useCallback(() => {
    if (throttledRef.current) return;
    
    throttledRef.current = true;
    
    rafRef.current = requestAnimationFrame(() => {
      lastActivityRef.current = Date.now();
      setStatus('active');
      
      setTimeout(() => {
        throttledRef.current = false;
      }, throttleMs);
    });
  }, [throttleMs]);

  const checkIdle = useCallback(() => {
    const elapsed = Date.now() - lastActivityRef.current;
    if (elapsed >= idleTimeout) {
      setStatus('idle');
    }
  }, [idleTimeout]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    idleCheckRef.current = window.setInterval(checkIdle, 1000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      
      if (idleCheckRef.current) {
        clearInterval(idleCheckRef.current);
      }
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updateActivity, checkIdle]);

  return {
    status,
    isActive: status === 'active',
    isIdle: status === 'idle',
  };
}