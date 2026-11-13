import React from 'react';
import { Lock } from 'lucide-react';
import { STATUS_STYLES } from './types';
import { cn } from '../../lib/utils';

export interface ReportStatusPillProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

export const ReportStatusPill: React.FC<ReportStatusPillProps> = ({
  status,
  className,
  showDot = true,
}) => {
  const config = STATUS_STYLES[status] || STATUS_STYLES['Pending'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border',
        config.bg,
        config.text,
        config.border,
        className
      )}
      title={config.isLocked ? 'Report is locked after approval' : undefined}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
      {config.isLocked && (
        <Lock className="h-3 w-3 shrink-0 opacity-70 ml-0.5" aria-label="Locked" />
      )}
    </span>
  );
};
