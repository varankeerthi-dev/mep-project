import { useState, useEffect } from 'react';

/**
 * Hook providing a live Date object updated on a minute-aligned interval.
 * Replaces high-frequency 1-second timers to eliminate unnecessary VDOM re-renders
 * for components only displaying minute-level time (hour:minute).
 */
export function useLiveDate(intervalMs = 60000): Date {
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    const now = new Date();
    // Synchronize initial tick to the top of the next minute
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const timeoutId = setTimeout(() => {
      setDate(new Date());
      intervalId = setInterval(() => setDate(new Date()), intervalMs);
    }, Math.max(msToNextMinute, 0));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs]);

  return date;
}
