import React from 'react';
import { colors, radii } from '../../design-system';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  dotColor?: string;
}

const variants = {
  default: { bg: colors.primary[100], text: colors.primary[700] },
  success: { bg: colors.success.light, text: colors.success.dark },
  warning: { bg: colors.warning.light, text: colors.warning.dark },
  error: { bg: colors.error.light, text: colors.error.dark },
  info: { bg: colors.info.light, text: colors.info.dark },
  neutral: { bg: colors.gray[200], text: colors.gray[700] },
};

export function Badge({ children, variant = 'default', size = 'md', dot, dotColor }: BadgeProps) {
  const theme = variants[variant];
  const effectiveDotColor = dotColor || theme.text;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? '12px' : '13px',
        fontWeight: 500,
        borderRadius: radii.full,
        background: theme.bg,
        color: theme.text,
        lineHeight: 1,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: effectiveDotColor,
          }}
        />
      )}
      {children}
    </span>
  );
}

// Priority Badge - uses priority colors from design system
export function PriorityBadge({ priority }: { priority: 'low' | 'normal' | 'high' | 'urgent' }) {
  const theme = colors.priority[priority];
  return (
    <Badge
      variant="neutral"
      dot
      dotColor={theme.dot}
    >
      <span style={{ color: theme.text, textTransform: 'capitalize' }}>{priority}</span>
    </Badge>
  );
}

// Status Badge - uses status colors from design system
export function StatusBadge({ status }: { status: 'open' | 'in_progress' | 'resolved' | 'closed' }) {
  const theme = colors.status[status];
  const label = status.replace('_', ' ');
  return (
    <Badge
      variant="neutral"
      dot
      dotColor={theme.dot}
    >
      <span style={{ color: theme.text, textTransform: 'capitalize' }}>{label}</span>
    </Badge>
  );
}
