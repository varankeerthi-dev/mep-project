import { memo } from 'react';
import {
  ArrowRight,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react';
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
    <div
      className={cn(
        'flex items-center border-b border-zinc-100 border-l-2 border-transparent bg-white px-4 py-[18px] transition-all duration-200',
        'hover:border-l-blue-600 hover:bg-blue-100/80'
      )}
    >
      <span className="w-[50px] shrink-0 py-[2px] text-center text-sm font-medium text-zinc-400">
        {rank}
      </span>

      <span
        className={cn(
          'inline-flex w-[90px] shrink-0 items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset',
          BAND_STYLES[item.priority_band]
        )}
      >
        {item.priority_band}
      </span>

      <span
        className={cn(
          'inline-flex w-[90px] shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-semibold',
          SOURCE_STYLES[item.source_tab]
        )}
      >
        {SOURCE_TAB_LABELS[item.source_tab]}
      </span>

      <span className="w-[140px] shrink-0 px-3 py-[2px] text-sm font-medium text-zinc-900">
        {item.reference_label}
      </span>

      <div className="w-[300px] shrink-0 px-3">
        <p className="truncate py-[2px] text-sm text-zinc-800" title={item.client_name}>
          {item.client_name}
        </p>
        <p className="truncate py-[2px] text-sm text-zinc-500" title={item.project_name}>
          {item.project_name}
        </p>
      </div>

      <div className="w-[120px] shrink-0 px-3 text-right">
        <p className="py-[2px] text-sm font-medium tabular-nums text-zinc-900">
          {formatFollowUpCurrency(item.amount)}
        </p>
      </div>

      <div className="w-[160px] shrink-0 px-3 text-center">
        <p className="truncate py-[2px] text-sm text-zinc-700" title={item.urgency_label}>
          {item.urgency_label}
        </p>
        <p className="truncate py-[2px] text-sm text-zinc-500" title={item.reason}>
          {item.reason}
        </p>
      </div>

      <div className="w-[100px] shrink-0 px-3">
        <AssigneeBadge name={assigneeLabel} unassigned={!item.assignee_user_id} />
      </div>

      <div className="flex w-[80px] shrink-0 items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
        {onQuickAction && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onQuickAction(item)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            title="Send reminder"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenSource(item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

export const priorityQueueTableHeader = (
  <div className="flex h-[36px] items-center px-4 text-[13px] font-semibold text-zinc-700 tracking-tight">
    <span className="w-[50px] shrink-0 text-center">#</span>
    <span className="w-[90px] shrink-0 text-left">Band</span>
    <span className="w-[90px] shrink-0 text-left">Type</span>
    <span className="w-[140px] shrink-0 px-3 text-left">Reference</span>
    <div className="w-[300px] shrink-0 px-3 text-left">Client / Project</div>
    <span className="w-[120px] shrink-0 px-3 text-right">Amount</span>
    <span className="w-[160px] shrink-0 px-3 text-center">Urgency</span>
    <span className="w-[100px] shrink-0 px-3 text-left">Assignee</span>
    <span className="w-[80px] shrink-0 text-center">Actions</span>
  </div>
);
