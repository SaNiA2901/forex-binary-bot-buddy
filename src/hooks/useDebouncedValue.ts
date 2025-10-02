/**
 * DEBOUNCED VALUE HOOK
 * Generic hook for debouncing any value changes
 */

import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of the value
 * Useful for expensive operations like validation or API calls
 * 
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
