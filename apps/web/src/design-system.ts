// DenialDesk-Inspired Design System
// Clean, modern dashboard UI with subtle shadows and clear hierarchy

export const colors = {
  // Primary palette
  primary: {
    50: '#eaf2fb',
    100: '#d4e4f6',
    200: '#a9c9ed',
    300: '#7dafe3',
    400: '#4f9fe0',
    500: '#2b84c4',
    600: '#185FA5',
    700: '#134b83',
    800: '#0C447C',
    900: '#0a3a68',
  },
  // Neutral grays
  gray: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e8ecf1',
    300: '#d5dbe3',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  // Semantic colors
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
    closed: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
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
  card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  elevated: '0 4px 12px rgba(0,0,0,0.06)',
};

export const radii = {
  sm: '6px',
  DEFAULT: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
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
    sans: '"Uncut Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    '4xl': { size: '30px', lineHeight: '36px' },
    stat: { size: '32px', lineHeight: '36px' },
    hero: { size: '36px', lineHeight: '40px' },
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
