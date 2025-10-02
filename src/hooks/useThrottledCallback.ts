/**
 * THROTTLED CALLBACK HOOK
 * Generic hook for throttling callback execution
 */

import { useCallback, useRef } from 'react';

/**
 * Returns a throttled version of the callback
 * Useful for rate-limiting expensive operations like auto-save
 * 
 * @param callback - Function to throttle
 * @param delay - Delay in milliseconds (default: 1000ms)
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1000
): T {
  const lastRun = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    if (timeSinceLastRun >= delay) {
      // Execute immediately if enough time has passed
      lastRun.current = now;
      callback(...args);
    } else {
      // Schedule execution for later
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastRun);
    }
  }, [callback, delay]) as T;
}
