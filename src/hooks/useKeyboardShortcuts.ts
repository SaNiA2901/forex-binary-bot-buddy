/**
 * KEYBOARD SHORTCUTS HOOK
 * Professional keyboard shortcuts management
 */

import { useEffect, useCallback, useRef } from 'react';
import { secureLogger } from '@/utils/secureLogger';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
  enableLogging?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  preventDefault = true,
  enableLogging = false
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const matchedShortcut = shortcutsRef.current.find(shortcut => {
        if (shortcut.disabled) return false;

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchedShortcut) {
        if (preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }

        if (enableLogging) {
          secureLogger.info('Keyboard shortcut triggered', {
            key: matchedShortcut.key,
            description: matchedShortcut.description
          });
        }

        try {
          matchedShortcut.action();
        } catch (error) {
          secureLogger.error('Error executing keyboard shortcut', { error });
        }
      }
    },
    [enabled, preventDefault, enableLogging]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  const getShortcutString = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }, []);

  return { getShortcutString };
}
