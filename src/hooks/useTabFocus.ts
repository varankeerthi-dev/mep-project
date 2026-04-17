import { useEffect, useState, useCallback } from 'react';

interface UseTabFocusReturn {
  isVisible: boolean;
  isFocused: boolean;
  hasFocus: boolean;
}

export function useTabFocus(): UseTabFocusReturn {
  const [hasFocus, setHasFocus] = useState<boolean>(true);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  const handleVisibilityChange = useCallback(() => {
    const visible = document.visibilityState === 'visible';
    setIsVisible(visible);
    
    if (!visible) {
      setHasFocus(false);
    }
  }, []);

  const handleFocus = useCallback(() => {
    setHasFocus(true);
  }, []);

  const handleBlur = useCallback(() => {
    setHasFocus(false);
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    if (typeof document.visibilityState !== 'undefined') {
      setIsVisible(document.visibilityState === 'visible');
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleVisibilityChange, handleFocus, handleBlur]);

  return {
    isVisible,
    isFocused: hasFocus && isVisible,
    hasFocus,
  };
}