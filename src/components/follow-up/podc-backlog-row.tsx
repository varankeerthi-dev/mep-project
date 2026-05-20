import { memo, useState } from 'react';
import { AlertTriangle, MessageCircle, Flag } from 'lucide-react';
import type { PodcBacklogItem, PodcIssueFlag } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { AssigneeSelect } from './assignee-select';
import { PODC_ISSUE_OPTIONS } from '@/types/followup';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import {
  deliveryProofColor,
  disputeColor,
  formatDeliveryProofStatus,
  formatDisputeStatus,
  formatIssueFlag,
} from '@/lib/followup/followup-formatters';
import { cn } from '@/lib/utils';

type PodcBacklogRowProps = {
  item: PodcBacklogItem;
  disabled?: boolean;
  assignees: FollowUpAssigneeOption[];
  onSharePack: (item: PodcBacklogItem) => void;
  onFlagIssue: (id: string, issue: PodcIssueFlag) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onSelect?: () => void;
};

export const PodcBacklogRow = memo(function PodcBacklogRow({
  item,
  disabled,
  assignees,
  onSharePack,
  onFlagIssue,
  onAssigneeChange,
  onSelect,
}: PodcBacklogRowProps) {
  const [flagOpen, setFlagOpen] = useState(false);
  const daysClass =
    item.days_pending_po >= 30
      ? 'text-red-700 font-bold'
      : item.days_pending_po >= 14
        ? 'text-amber-700 font-semibold'
        : 'text-zinc-700';

  return (
    <div
      className="grid grid-cols-[minmax(92px,1fr)_minmax(100px,1fr)_minmax(118px,1.1fr)_72px_64px_92px_92px_72px_72px_minmax(108px,118px)_1fr] items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-xs hover:bg-zinc-50/80"
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <span className="font-mono font-medium text-zinc-900">{item.dc_wo_number}</span>
      <span className="truncate font-medium" title={item.client_name}>
        {item.client_name}
      </span>
      <span className="truncate text-zinc-600" title={item.project_name}>
        {item.project_name}
      </span>
      <span className="tabular-nums text-right font-medium">{formatFollowUpCurrency(item.estimated_value)}</span>
      <span className={cn('tabular-nums text-center', daysClass)}>{item.days_pending_po}d</span>
      <span className="truncate text-zinc-600" title={item.site_engineer}>
        {item.site_engineer}
      </span>
      <span className="truncate text-zinc-500" title={item.client_coordinator}>
        {item.client_coordinator}
      </span>
      <span
        className={cn(
          'inline-flex w-fit rounded px-1 py-0.5 text-[10px] font-medium',
          deliveryProofColor(item.delivery_proof_status)
        )}
      >
        {formatDeliveryProofStatus(item.delivery_proof_status)}
      </span>
      <span
        className={cn(
          'inline-flex w-fit rounded px-1 py-0.5 text-[10px] font-medium',
          disputeColor(item.dispute_status)
        )}
      >
        {formatDisputeStatus(item.dispute_status)}
      </span>
      <AssigneeSelect
        value={item.assignee_user_id}
        options={assignees}
        disabled={disabled}
        compact
        onChange={(userId) => onAssigneeChange(item.id, userId)}
      />
      <div className="flex items-center justify-end gap-1">
        {item.issue_flag && (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1 text-[10px] text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {formatIssueFlag(item.issue_flag)}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSharePack(item)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageCircle className="h-3 w-3" />
          Share DC
        </button>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setFlagOpen((o) => !o)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flag className="h-3 w-3" />
            Flag
          </button>
          {flagOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setFlagOpen(false)} />
              <ul className="absolute right-0 z-30 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {PODC_ISSUE_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-[11px] hover:bg-zinc-50"
                      onClick={() => {
                        onFlagIssue(item.id, opt.value);
                        setFlagOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export const podcTableHeader = (
  <div className="grid grid-cols-[minmax(92px,1fr)_minmax(100px,1fr)_minmax(118px,1.1fr)_72px_64px_92px_92px_72px_72px_minmax(108px,118px)_1fr] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
    <span>DC / WO</span>
    <span>Client</span>
    <span>Project</span>
    <span className="text-right">Est. value</span>
    <span className="text-center">Pending</span>
    <span>Site eng.</span>
    <span>Coordinator</span>
    <span>Proof</span>
    <span>Dispute</span>
    <span>Assignee</span>
    <span className="text-right">Actions</span>
  </div>
);
