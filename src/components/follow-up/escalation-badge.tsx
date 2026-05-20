import { cn } from '@/lib/utils';
import type { EscalationStageMeta } from '@/lib/followup/escalation-engine';

type EscalationBadgeProps = {
  meta: EscalationStageMeta;
  compact?: boolean;
};

const severityClass: Record<EscalationStageMeta['severity'], string> = {
  info: 'bg-sky-100 text-sky-800 ring-sky-200',
  warning: 'bg-amber-100 text-amber-900 ring-amber-200',
  danger: 'bg-orange-100 text-orange-900 ring-orange-200',
  critical: 'bg-red-100 text-red-900 ring-red-300',
};

export function EscalationBadge({ meta, compact }: EscalationBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        severityClass[meta.severity]
      )}
      title={meta.description}
    >
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
