// Ambient "next action" chip — drop it onto any client row to surface the
// most-pressing open follow-up. The whole point: follow-up becomes ambient,
// not a tab visit.

import { useMemo } from 'react';
import { useClientNextAction } from '@/hooks/use-leads';
import { ESCALATION_LABELS, ESCALATION_VARIANT } from '@/types/leads';
import type { NextAction } from '@/types/leads';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';

interface NextActionChipProps {
  clientId: string | null | undefined;
  className?: string;
  /** When true, render only an icon dot (for table cells with limited space). */
  compact?: boolean;
  /** Click handler — typically navigates to the source record. */
  onClick?: (next: NextAction) => void;
}

const SOURCE_LABEL: Record<NextAction['source_type'], string> = {
  lead: 'Lead',
  quotation: 'Quote',
  podc: 'PO/DC',
  invoice: 'Invoice',
};

function formatRelative(hours: number): string {
  if (hours < 0) {
    return `${formatDistanceToNowStrict(new Date(Date.now() + hours * 3600_000))} overdue`;
  }
  if (hours < 24) {
    return `in ${Math.round(hours)}h`;
  }
  return `in ${Math.round(hours / 24)}d`;
}

const variantClasses: Record<'default' | 'warning' | 'danger', string> = {
  default: 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
  danger: 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100',
};

const dotClasses: Record<'default' | 'warning' | 'danger', string> = {
  default: 'bg-zinc-400',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

export function NextActionChip({ clientId, className, compact = false, onClick }: NextActionChipProps) {
  const { data: next, isLoading } = useClientNextAction(clientId);

  const variant = useMemo<'default' | 'warning' | 'danger'>(() => {
    if (!next) return 'default';
    const stage = (next.escalation_stage ?? 0) as 0 | 1 | 2 | 3 | 4;
    return ESCALATION_VARIANT[stage];
  }, [next]);

  if (isLoading) {
    return (
      <span
        className={cn(
          'inline-flex h-6 w-24 animate-pulse rounded-md border border-zinc-200 bg-zinc-100',
          className
        )}
        aria-label="Loading next action"
      />
    );
  }

  if (!next) {
    return (
      <span
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-400',
          className
        )}
        title="No follow-up scheduled"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
        Clear
      </span>
    );
  }

  const stage = (next.escalation_stage ?? 0) as 0 | 1 | 2 | 3 | 4;
  const label = compact ? SOURCE_LABEL[next.source_type] : next.next_action_label || SOURCE_LABEL[next.source_type];
  const timeText = formatRelative(next.hours_until_due);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(next)}
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors',
          variantClasses[variant],
          className
        )}
        title={`${next.next_action_label} · ${timeText} · ${ESCALATION_LABELS[stage]}`}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[variant])} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(next)}
      className={cn(
        'group inline-flex max-w-[280px] items-center gap-2 rounded-md border px-2.5 py-1 text-left text-xs transition-colors',
        variantClasses[variant],
        className
      )}
      title={`${next.reference_label} · ${ESCALATION_LABELS[stage]}`}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[variant])} />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="shrink-0 text-[10px] font-medium opacity-75">{timeText}</span>
    </button>
  );
}
