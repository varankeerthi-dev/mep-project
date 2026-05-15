import { CN_STATUS_COLORS, CN_STATUS_LABELS } from '../schemas';
import type { CNApprovalStatus } from '../schemas';

type StatusBadgeProps = {
  status: CNApprovalStatus | string;
  size?: 'sm' | 'md';
};

export function CNStatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = CN_STATUS_COLORS[status as CNApprovalStatus] ?? { bg: '#f3f4f6', color: '#737373' };
  const label = CN_STATUS_LABELS[status as CNApprovalStatus] ?? status;
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 600,
        background: colors.bg,
        color: colors.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
