import React from 'react';

interface StatusBadgeConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

const statusConfigs: Record<string, StatusBadgeConfig> = {
  draft: {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#e2e8f0',
    dot: '#94a3b8',
    label: 'Draft',
  },
  sent: {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
    dot: '#3b82f6',
    label: 'Sent',
  },
  accepted: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e',
    label: 'Accepted',
  },
  approved: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e',
    label: 'Approved',
  },
  rejected: {
    bg: '#fef2f2',
    text: '#b91c1c',
    border: '#fecaca',
    dot: '#ef4444',
    label: 'Rejected',
  },
  converted: {
    bg: '#f5f3ff',
    text: '#6d28d9',
    border: '#ddd6fe',
    dot: '#8b5cf6',
    label: 'Converted',
  },
  expired: {
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b',
    label: 'Expired',
  },
  final: {
    bg: '#ecfdf5',
    text: '#047857',
    border: '#a7f3d0',
    dot: '#10b981',
    label: 'Final',
  },
  paid: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e',
    label: 'Paid',
  },
  overdue: {
    bg: '#fef2f2',
    text: '#dc2626',
    border: '#fecaca',
    dot: '#ef4444',
    label: 'Overdue',
  },
  cancelled: {
    bg: '#f1f5f9',
    text: '#64748b',
    border: '#e2e8f0',
    dot: '#94a3b8',
    label: 'Cancelled',
  },
  partial: {
    bg: '#dcfce7',
    text: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e',
    label: 'Partial',
  },
  unpaid: {
    bg: '#fee2e2',
    text: '#dc2626',
    border: '#fecaca',
    dot: '#ef4444',
    label: 'Unpaid',
  },
  partially_paid: {
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b',
    label: 'Partially Paid',
  },
};

interface DocumentStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function DocumentStatusBadge({ status, size = 'sm' }: DocumentStatusBadgeProps) {
  const configKey = status?.toLowerCase() || 'draft';
  const config = statusConfigs[configKey] || {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#e2e8f0',
    dot: '#94a3b8',
    label: status || 'Unknown',
  };

  const dotSize = size === 'sm' ? 5 : 7;
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '10px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 600,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
