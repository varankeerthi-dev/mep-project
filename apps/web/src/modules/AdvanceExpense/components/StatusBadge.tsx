import React from 'react';
import { STATUS_CONFIG, type AeStatus } from '../types';

export const StatusBadge: React.FC<{ status: AeStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        borderRadius: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
};
