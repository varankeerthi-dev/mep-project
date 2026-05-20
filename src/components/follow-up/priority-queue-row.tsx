import { memo } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import type { PriorityQueueItem } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { AssigneeBadge } from './assignee-select';
import { resolveAssigneeLabel } from '@/hooks/use-followup-assignees';
import { SOURCE_TAB_LABELS } from '@/lib/followup/priority-queue';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { cn } from '@/lib/utils';

const BAND_STYLES: Record<PriorityQueueItem['priority_band'], string> = {
  critical: 'bg-red-100 text-red-800 ring-red-200',
  high: 'bg-orange-100 text-orange-900 ring-orange-200',
  medium: 'bg-amber-100 text-amber-900 ring-amber-200',
  low: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

const SOURCE_STYLES: Record<PriorityQueueItem['source_tab'], string> = {
  quotation: 'bg-indigo-50 text-indigo-700',
  podc: 'bg-emerald-50 text-emerald-800',
  invoice: 'bg-sky-50 text-sky-800',
};

type PriorityQueueRowProps = {
  item: PriorityQueueItem;
  rank: number;
  assignees: FollowUpAssigneeOption[];
  disabled?: boolean;
  onOpenSource: (item: PriorityQueueItem) => void;
  onQuickAction?: (item: PriorityQueueItem) => void;
};

export const PriorityQueueRow = memo(function PriorityQueueRow({
  item,
  rank,
  assignees,
  disabled,
  onOpenSource,
  onQuickAction,
}: PriorityQueueRowProps) {
  const assigneeLabel = resolveAssigneeLabel(
    assignees,
    item.assignee_user_id,
    item.assignee_name
  );

  return (
    <div className="grid grid-cols-[32px_56px_72px_minmax(96px,1fr)_minmax(110px,1.1fr)_80px_minmax(120px,1.3fr)_minmax(100px,110px)_1fr] items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50/90">
      <span className="tabular-nums text-[11px] font-medium text-zinc-400">{rank}</span>
      <span
        className={cn(
          'inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
          BAND_STYLES[item.priority_band]
        )}
      >
        {item.priority_score}
      </span>
      <span
        className={cn(
          'inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold',
          SOURCE_STYLES[item.source_tab]
        )}
      >
        {SOURCE_TAB_LABELS[item.source_tab]}
      </span>
      <span className="font-mono font-medium text-zinc-900">{item.reference_label}</span>
      <span className="truncate font-medium" title={item.client_name}>
        {item.client_name}
      </span>
      <span className="tabular-nums text-right font-semibold text-zinc-900">
        {formatFollowUpCurrency(item.amount)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-zinc-700">{item.urgency_label}</p>
        <p className="truncate text-[10px] text-zinc-500" title={item.reason}>
          {item.reason}
        </p>
        <AssigneeBadge name={assigneeLabel} unassigned={!item.assignee_user_id} />
      </div>
      <div className="flex items-center justify-end gap-1">
        {onQuickAction && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onQuickAction(item)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            title="Send reminder"
          >
            <MessageCircle className="h-3 w-3" />
            Act
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenSource(item)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

export const priorityQueueTableHeader = (
  <div className="grid grid-cols-[32px_56px_72px_minmax(96px,1fr)_minmax(110px,1.1fr)_80px_minmax(120px,1.3fr)_minmax(100px,110px)_1fr] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
    <span>#</span>
    <span>Score</span>
    <span>Type</span>
    <span>Reference</span>
    <span>Client</span>
    <span className="text-right">Amount</span>
    <span>Urgency / assignee</span>
    <span className="text-right">Actions</span>
  </div>
);
