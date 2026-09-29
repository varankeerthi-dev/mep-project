import { useEffect, useRef } from 'react';

type UseQuickShortcutsOptions = {
  enabled: boolean;
  currentPath: string;
  onQuickQuote: () => void;
  windowMs?: number;
};

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || typeof (t as any).closest !== 'function') return false;
  return !!t.closest('input, textarea, select, [contenteditable="true"]');
}

/**
 * Global two-key shortcut: press `q` twice quickly to open Create Quotation.
 * Ignored while typing, with modifiers held, or when already there.
 */
export function useQuickShortcuts({ enabled, currentPath, onQuickQuote, windowMs = 800 }: UseQuickShortcutsOptions) {
  const lastQAt = useRef(0);
  const ref = useRef({ currentPath, onQuickQuote });
  ref.current = { currentPath, onQuickQuote };

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'q' && e.key !== 'Q') {
        lastQAt.current = 0;
        return;
      }
      if (isTypingTarget(e)) return;
      const now = Date.now();
      if (now - lastQAt.current <= windowMs) {
        lastQAt.current = 0;
        const path = ref.current.currentPath.split('?')[0];
        if (path === '/quotation/create') return;
        e.preventDefault();
        ref.current.onQuickQuote();
      } else {
        lastQAt.current = now;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, windowMs]);
}
