import { cn } from '@/lib/utils';
import type { EscalationStageMeta } from '@/lib/followup/escalation-engine';

type EscalationBadgeProps = {
  meta: EscalationStageMeta;
  compact?: boolean;
};

const severityClass: Record<EscalationStageMeta['severity'], string> = {
  info: 'bg-blue-100 text-blue-800 ring-blue-200',
  warning: 'bg-amber-100 text-amber-900 ring-amber-200',
  danger: 'bg-amber-100 text-amber-900 ring-amber-200',
  critical: 'bg-red-100 text-red-900 ring-red-300',
};

export function EscalationBadge({ meta, compact }: EscalationBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ring-1 ring-inset',
        severityClass[meta.severity]
      )}
      title={meta.description}
    >
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
