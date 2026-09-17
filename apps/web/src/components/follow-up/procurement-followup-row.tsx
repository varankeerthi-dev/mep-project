import { memo } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ProcurementFollowUp } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { AssigneeSelect } from './assignee-select';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { formatFollowUpDate } from '@/lib/followup/date-format';
import { cn } from '@/lib/utils';

type ProcurementFollowupRowProps = {
  item: ProcurementFollowUp;
  disabled?: boolean;
  assignees: FollowUpAssigneeOption[];
  onReminder: (item: ProcurementFollowUp) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onSelect?: () => void;
};

export const ProcurementFollowupRow = memo(function ProcurementFollowupRow({
  item,
  disabled,
  assignees,
  onReminder,
  onAssigneeChange,
  onSelect,
}: ProcurementFollowupRowProps) {
  const isDelayed = item.status === 'delayed';
  const isCompleted = item.status === 'completed';

  const statusColors = {
    pending_inquiry: 'bg-blue-50 text-blue-700 border-blue-100',
    po_draft: 'bg-slate-50 text-slate-600 border-slate-200',
    pending_delivery: 'bg-amber-50 text-amber-700 border-amber-100',
    delayed: 'bg-red-50 text-red-700 border-red-100',
    completed: 'bg-green-50 text-green-700 border-green-100',
  };

  const statusLabels = {
    pending_inquiry: 'Inquiry Pending',
    po_draft: 'Draft',
    pending_delivery: 'Pending Delivery',
    delayed: 'Delayed',
    completed: 'Completed',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_110px_90px_minmax(108px,120px)_1fr] items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 transition duration-150',
        isCompleted && 'bg-slate-50/40 opacity-80',
        isDelayed && 'bg-red-50/10'
      )}
      onClick={isCompleted ? undefined : onSelect}
      role={onSelect && !isCompleted ? 'button' : undefined}
      tabIndex={onSelect && !isCompleted ? 0 : undefined}
    >
      <span className="font-mono font-medium text-blue-700">{item.po_no}</span>
      <span className="truncate font-medium text-slate-900" title={item.vendor_name}>
        {item.vendor_name}
      </span>
      <span className="truncate text-slate-600" title={item.project_name}>
        {item.project_name}
      </span>
      <span className="tabular-nums font-medium text-slate-900 text-left">
        {formatFollowUpCurrency(item.total_value)}
      </span>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
          statusColors[item.status]
        )}
      >
        {statusLabels[item.status]}
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn('tabular-nums font-medium', isDelayed && 'text-red-600 font-semibold')}>
          {item.days_pending_vendor}d pending
        </span>
        <span className="tabular-nums text-slate-600">Exp {formatFollowUpDate(item.expected_date)}</span>
        {(item.call_count || 0) > 0 ? (
          <span className="text-[10px] text-slate-400">
            {item.call_count} call{item.call_count === 1 ? '' : 's'} · last {formatFollowUpDate(item.last_call_at)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300">no calls logged</span>
        )}
      </span>
      <AssigneeSelect
        value={item.assignee_user_id}
        options={assignees}
        disabled={disabled}
        compact
        onChange={(userId) => onAssigneeChange(item.id, userId)}
      />
      <div className="flex items-center justify-end gap-1">
        {!isCompleted && (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onReminder(item);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 text-[11px] font-medium text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-3 w-3" />
            Remind
          </button>
        )}
      </div>
    </div>
  );
});

export const procurementTableHeader = (
  <div className="grid grid-cols-[minmax(96px,1fr)_minmax(110px,1.1fr)_minmax(120px,1.2fr)_80px_110px_90px_minmax(108px,120px)_1fr] gap-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 leading-normal select-none">
    <span>PO #</span>
    <span>Vendor</span>
    <span>Project</span>
    <span className="text-left">Value</span>
    <span>Status</span>
    <span>Timeline</span>
    <span>Assignee</span>
    <span className="text-right">Actions</span>
  </div>
);
