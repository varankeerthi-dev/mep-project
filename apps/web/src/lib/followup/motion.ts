import type { Transition, Variants } from 'framer-motion'

/**
 * Follow-Up Centre motion presets (framer-motion).
 *
 * Replaces the previous CSS-keyframe motion layer, which shipped 5.8KB of
 * `.fu-*` classes that no component ever referenced. These presets are the
 * live equivalent: every value here is consumed by a component.
 *
 * Design intent is unchanged — DESIGN.md specifies stiffness 170 / damping 20,
 * which we express through the modern `duration` + `bounce` spring API so the
 * motion stays critically damped and never overshoots.
 *
 * Per better-ui:
 * - `bounce: 0` always. Underdamped springs read as "bouncy UI".
 * - Interactive state changes stay on CSS transitions (interruptible).
 * - Keyframes are reserved for staged sequences that run once.
 * - Exits are shorter and softer than entrances.
 */

/** Default spring for panels, drawers and rows. */
export const spring: Transition = { type: 'spring', duration: 0.3, bounce: 0 }

/** Faster spring for small elements — badges, chips, inline buttons. */
export const springSnappy: Transition = { type: 'spring', duration: 0.2, bounce: 0 }

/** Exit is deliberately shorter than entrance so dismissal feels instant. */
export const springExit: Transition = { type: 'spring', duration: 0.18, bounce: 0 }

/**
 * Row stagger. 20ms per row (DESIGN.md), not better-ui's ~100ms — that figure
 * is for semantic page chunks, and on a 40-row queue table it would push the
 * last row ~4s past first paint. No jitter: it breaks the rhythm of
 * consecutive items and reads as instability rather than intent.
 */
export const staggerDelay = 0.02

/** Right-hand drawer / action sheet. */
export const drawerVariants: Variants = {
  hidden: { x: '100%', opacity: 1 },
  visible: { x: 0, opacity: 1, transition: spring },
  exit: { x: '100%', opacity: 1, transition: springExit },
}

/** Scrim behind a drawer or modal. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

/** Container that staggers its children. */
export const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerDelay, delayChildren: 0.02 },
  },
}

/** Individual list row. Small translateY keeps the cascade from feeling heavy. */
export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springSnappy },
}

/** Cross-fade used when a side panel swaps to a different record. */
export const panelSwapVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
}

/** Height/opacity reveal for toolbars and selection bars appearing on demand. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
}

/**
 * Reduced-motion variants. When the user prefers reduced motion we cross-fade
 * or cut, but never remove the element — instant swaps still need an exit so
 * AnimatePresence doesn't leave layout holes.
 */
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
}

export const reducedRowVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
}

export const reducedListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
}

/**
 * Pick the right variant set for the current motion preference.
 * `useReducedMotion` from framer-motion is a live subscription, unlike a bare
 * `matchMedia` read, so it reacts to the OS setting changing mid-session.
 */
export function useMotionVariants(prefersReducedMotion: boolean) {
  return prefersReducedMotion
    ? {
        drawer: reducedMotionVariants,
        backdrop: reducedMotionVariants,
        panel: reducedMotionVariants,
        list: reducedListVariants,
        row: reducedRowVariants,
        reveal: reducedMotionVariants,
      }
    : {
        drawer: drawerVariants,
        backdrop: backdropVariants,
        panel: panelSwapVariants,
        list: listVariants,
        row: rowVariants,
        reveal: revealVariants,
      }
}
