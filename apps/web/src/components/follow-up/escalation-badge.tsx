import { cn } from '@/lib/utils';
import type { EscalationStageMeta } from '@/lib/followup/escalation-engine';

type EscalationBadgeProps = {
  meta: EscalationStageMeta;
  compact?: boolean;
};

// A four-step severity ramp: blue → amber → orange → red.
// `danger` and `warning` previously shared an identical amber scale, which
// made the two indistinguishable exactly where urgency triage happens.
const severityClass: Record<EscalationStageMeta['severity'], string> = {
  info: 'bg-blue-100 text-blue-800 ring-blue-200',
  warning: 'bg-amber-100 text-amber-900 ring-amber-200',
  danger: 'bg-orange-100 text-orange-900 ring-orange-300',
  critical: 'bg-red-100 text-red-900 ring-red-300',
};

export function EscalationBadge({ meta, compact }: EscalationBadgeProps) {
  const label = compact ? meta.shortLabel : meta.label;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ring-1 ring-inset',
        severityClass[meta.severity]
      )}
      title={meta.description}
      // `title` alone is unreliable for assistive tech; state the full
      // severity and its meaning so urgency is not conveyed by colour alone.
      aria-label={`${meta.label}: ${meta.description}`}
    >
      {label}
    </span>
  );
}
