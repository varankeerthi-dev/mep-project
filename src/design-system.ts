// Capy-Inspired Design System
// Minimal, clean, modern UI with soft accents and smooth interactions

export const colors = {
  // Primary palette
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Neutral grays - soft and warm
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  // Semantic colors - soft variants
  success: {
    light: '#dcfce7',
    DEFAULT: '#22c55e',
    dark: '#166534',
  },
  warning: {
    light: '#fef3c7',
    DEFAULT: '#f59e0b',
    dark: '#b45309',
  },
  error: {
    light: '#fee2e2',
    DEFAULT: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    light: '#dbeafe',
    DEFAULT: '#3b82f6',
    dark: '#1e40af',
  },
  // Priority colors
  priority: {
    low: { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    normal: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    high: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
    urgent: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  },
  // Status colors
  status: {
    open: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
    in_progress: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    resolved: { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    closed: { bg: '#f4f4f5', text: '#71717a', dot: '#a1a1aa' },
  },
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: 'none',
};

export const radii = {
  sm: '6px',
  DEFAULT: '10px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  DEFAULT: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  DEFAULT: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const typography = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  sizes: {
    xs: { size: '12px', lineHeight: '16px' },
    sm: { size: '13px', lineHeight: '18px' },
    base: { size: '14px', lineHeight: '20px' },
    lg: { size: '16px', lineHeight: '24px' },
    xl: { size: '18px', lineHeight: '28px' },
    '2xl': { size: '20px', lineHeight: '28px' },
    '3xl': { size: '24px', lineHeight: '32px' },
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// Helper to merge styles
export const cx = (...classes: (string | undefined | false)[]) => 
  classes.filter(Boolean).join(' ');
