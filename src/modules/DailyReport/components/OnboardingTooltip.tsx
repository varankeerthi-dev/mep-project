// ============================================
// OnboardingTooltip — Phase 6.2
// ============================================
// One-time tooltip for users landing in the new structured
// daily-report form. Surfaces on the first visit after the
// VITE_DAILY_REPORTS_V2 flag is enabled, and dismisses
// permanently (per-browser) when the user clicks "Got it".
//
// The tooltip is intentionally small (1 sentence, 1 button)
// — the goal is to flag the change, not to teach. A
// deeper walkthrough lives in the PRD §16 onboarding plan.
//
// Persistence key: dr:onboarding:v2-seen
//   Value: '1' once dismissed
//   The key is namespaced per-feature so a future v3
//   onboarding can be added without colliding.
// ============================================

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEEN_KEY = 'dr:onboarding:v2-seen';

export interface OnboardingTooltipProps {
  /** Optional explicit override. When set, the tooltip is
   *  shown regardless of localStorage. Used by the
   *  preview page to force-show during dev. */
  forceShow?: boolean;
  /** Inner body content (1–2 short lines). */
  message?: string;
  className?: string;
}

export function OnboardingTooltip({
  forceShow = false,
  message = 'Try the new structured form — link each item to a task and add photos inline.',
  className,
}: OnboardingTooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) setOpen(true);
    } catch {
      // storage disabled — show the tooltip
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (forceShow) setOpen(true);
  }, [forceShow]);

  if (!mounted || (!open && !forceShow)) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-900 shadow-sm',
        className
      )}
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">New here?</p>
        <p className="mt-0.5 text-[11px] text-blue-800/90">{message}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-7 items-center rounded-md bg-blue-600 px-2 text-[11px] font-medium text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-blue-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default OnboardingTooltip;
