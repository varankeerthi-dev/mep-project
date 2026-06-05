// Spring motion utilities for Follow-Up Centre
// Based on DESIGN.md: stiffness: 170, damping: 20, stagger: 20ms

export const springConfig = {
  // Main spring for UI elements
  ui: { stiffness: 170, damping: 20 },
  // Softer spring for larger panels
  panel: { stiffness: 150, damping: 22 },
  // Snappy spring for small elements (badges, chips)
  snappy: { stiffness: 200, damping: 18 },
  // Gentle spring for entrance animations
  entrance: { stiffness: 120, damping: 18 },
} as const;

export const duration = {
  fast: 150,
  normal: 200,
  slow: 300,
  entrance: 250,
  exit: 175,
  stagger: 20,
} as const;

export const easing = {
  // Spring-like cubic-bezier approximations for CSS
  springOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  springIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const;

// Stagger delay calculator with optional jitter
export function getStaggerDelay(index: number, baseDelay = duration.stagger, jitter = 5): number {
  return index * baseDelay + Math.random() * jitter;
}

// CSS animation keyframes as strings for dynamic injection
export const keyframes = {
  entrance: `
    @keyframes fu-entrance {
      0% { opacity: 0; transform: translateY(8px) scale(0.98); }
      60% { transform: translateY(-2px) scale(1.01); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
  `,
  slideInRight: `
    @keyframes fu-slide-in-right {
      0% { opacity: 0; transform: translateX(16px); }
      100% { opacity: 1; transform: translateX(0); }
    }
  `,
  slideInLeft: `
    @keyframes fu-slide-in-left {
      0% { opacity: 0; transform: translateX(-16px); }
      100% { opacity: 1; transform: translateX(0); }
    }
  `,
  fadeIn: `
    @keyframes fu-fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  `,
  scaleIn: `
    @keyframes fu-scale-in {
      0% { opacity: 0; transform: scale(0.95); }
      60% { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
  `,
  pulse: `
    @keyframes fu-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `,
  shake: `
    @keyframes fu-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
  `,
} as const;

// Animation class generators
export function getEntranceClass(index: number, reducedMotion = false): string {
  if (reducedMotion) return 'animate-fu-fade-in-reduced';
  
  const delay = getStaggerDelay(index);
  return `animate-fu-entrance`; // Delay applied via inline style
}

export function getEntranceStyle(index: number, reducedMotion = false): React.CSSProperties {
  if (reducedMotion) {
    return { animation: 'fu-fade-in-reduced 100ms ease-out both' };
  }
  const delay = getStaggerDelay(index);
  return {
    animation: `fu-entrance ${duration.entrance}ms ${easing.springOut} both`,
    animationDelay: `${delay}ms`,
  };
}

// Reduced motion variants
export const reducedMotionStyles = {
  entrance: { animation: 'fu-fade-in-reduced 100ms ease-out both' },
  slideIn: { animation: 'fu-fade-in-reduced 100ms ease-out both' },
  scaleIn: { animation: 'fu-fade-in-reduced 100ms ease-out both' },
} as const;

// Hover/active/focus transition utilities
export const transitions = {
  // Standard interactive transition
  interactive: `transform ${duration.fast}ms ${easing.easeOut}, box-shadow ${duration.fast}ms ${easing.easeOut}, background-color ${duration.fast}ms ${easing.easeOut}, border-color ${duration.fast}ms ${easing.easeOut}`,
  // Spring-like hover
  springHover: `transform ${duration.normal}ms ${easing.springOut}, box-shadow ${duration.normal}ms ${easing.easeOut}`,
  // Color only
  color: `color ${duration.fast}ms ${easing.easeOut}, background-color ${duration.fast}ms ${easing.easeOut}, border-color ${duration.fast}ms ${easing.easeOut}`,
  // Transform only
  transform: `transform ${duration.fast}ms ${easing.easeOut}`,
} as const;

// Check for reduced motion preference
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Hook for reduced motion (client-side only)
export function useReducedMotion(): boolean {
  // This would be implemented with useSyncExternalStore in a real hook
  // For now, return the static check
  return prefersReducedMotion();
}

// Motion variants for Framer Motion style usage (if needed later)
export const motionVariants = {
  entrance: {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: 'spring', stiffness: 170, damping: 20 }
    },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 16 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 170, damping: 20 }
    },
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -16 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 170, damping: 20 }
    },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.02, delayChildren: 0.05 }
    },
  },
  hover: {
    scale: 1.02,
    y: -1,
    transition: { type: 'spring', stiffness: 200, damping: 18 }
  },
  active: {
    scale: 0.98,
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
} as const;