import { ChevronDown } from 'lucide-react';
import type { FollowUpFiltersState, FollowUpTab } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { cn } from '@/lib/utils';

type FollowupFilterBarProps = {
  tab: FollowUpTab;
  filters: FollowUpFiltersState;
  assignees?: FollowUpAssigneeOption[];
  onChange: (patch: Partial<FollowUpFiltersState>) => void;
  quickFilter?: 'all' | 'due_today' | 'overdue' | 'waiting' | 'upcoming' | 'unassigned';
  onQuickFilterChange?: (qf: 'all' | 'due_today' | 'overdue' | 'waiting' | 'upcoming' | 'unassigned') => void;
  quickFilterCounts?: { due_today: number; overdue: number; waiting: number; upcoming: number; unassigned: number };
  queueTotalCount?: number;
  focusMode?: boolean;
  onFocusModeChange?: (focus: boolean) => void;
};

const dateInputClass =
  'h-[25px] rounded border border-slate-300 bg-white px-1.5 text-[11px] leading-none text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors duration-150 shadow-xs shrink-0';

function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || value;

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-1 h-[25px] rounded border border-slate-300 bg-white px-2 text-[11px] leading-none text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer select-none group shrink-0',
        className
      )}
    >
      {label && <span className="text-slate-400 font-normal leading-none">{label}:</span>}
      <span className="font-semibold text-slate-800 truncate max-w-[125px] leading-none">{displayLabel}</span>
      <ChevronDown className="h-2.5 w-2.5 text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors ml-0.5" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FollowupFilterBar({
  tab,
  filters,
  assignees = [],
  onChange,
  quickFilter = 'all',
  onQuickFilterChange,
  quickFilterCounts,
  queueTotalCount,
  focusMode,
  onFocusModeChange,
}: FollowupFilterBarProps) {
  // Assignee filter - shown for all tabs except activity
  const assigneeOptions = [
    { value: 'all', label: 'All' },
    { value: 'me', label: 'Assigned to me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...assignees.map((a) => ({ value: a.userId, label: a.label })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
      {/* Assignee Filter */}
      {tab !== 'activity' && (
        <FilterSelect
          label="Filter"
          value={filters.assignee || 'all'}
          options={assigneeOptions}
          onChange={(value) => onChange({ assignee: value })}
        />
      )}

      {/* Priority Queue specific filters: Type + Timing / Status + Sort */}
      {tab === 'queue' && (
        <>
          {/* Type Dropdown */}
          <FilterSelect
            label="Type"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'quotation', label: 'Quotations' },
              { value: 'podc', label: 'PO/DC' },
              { value: 'invoice', label: 'Invoices' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          {/* Timing / Status Dropdown (collapses the previous 2nd row) */}
          {onQuickFilterChange && (
            <FilterSelect
              label="Status"
              value={quickFilter}
              options={[
                { value: 'all', label: `All${queueTotalCount !== undefined ? ` (${queueTotalCount})` : ''}` },
                { value: 'due_today', label: `Due${quickFilterCounts ? ` (${quickFilterCounts.due_today})` : ''}` },
                { value: 'overdue', label: `Overdue${quickFilterCounts ? ` (${quickFilterCounts.overdue})` : ''}` },
                { value: 'waiting', label: `Waiting${quickFilterCounts ? ` (${quickFilterCounts.waiting})` : ''}` },
                { value: 'upcoming', label: `Upcoming${quickFilterCounts ? ` (${quickFilterCounts.upcoming})` : ''}` },
                { value: 'unassigned', label: `Unassigned${quickFilterCounts ? ` (${quickFilterCounts.unassigned})` : ''}` },
              ]}
              onChange={(value) => onQuickFilterChange(value as any)}
            />
          )}

          {/* Sort Dropdown */}
          <FilterSelect
            label="Sort by"
            value={filters.sort || 'priority_desc'}
            options={[
              { value: 'priority_desc', label: 'Priority' },
              { value: 'value_desc', label: 'Amount' },
              { value: 'client_asc', label: 'Client' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />
        </>
      )}

      {/* Quotation tab filters */}
      {tab === 'quotation' && (
        <>
          <FilterSelect
            label="Status"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'sent', label: 'Sent' },
              { value: 'under_review', label: 'Under Review' },
              { value: 'in_negotiation', label: 'In Negotiation' },
              { value: 'pending', label: 'Pending' },
              { value: 'on_hold', label: 'On Hold' },
              { value: 'approved', label: 'Approved' },
              { value: 'lost_to_competitor', label: 'Lost to Competitor' },
              { value: 'expired', label: 'Expired' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          <FilterSelect
            label="Sort by"
            value={filters.sort || 'value_desc'}
            options={[
              { value: 'value_desc', label: 'Value: High → Low' },
              { value: 'value_asc', label: 'Value: Low → High' },
              { value: 'validity_asc', label: 'Validity: Soonest' },
              { value: 'submitted_desc', label: 'Submitted: Newest' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />

          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer shrink-0 ml-1">
            <input
              type="checkbox"
              checked={filters.expiringSoon}
              onChange={(e) => onChange({ expiringSoon: e.target.checked })}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600/20"
            />
            <span className="hover:text-slate-900">Expiring ≤7d</span>
          </label>

          <input
            type="date"
            className={dateInputClass}
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            title="Submitted from"
            placeholder="From"
          />
          <input
            type="date"
            className={dateInputClass}
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            title="Submitted to"
            placeholder="To"
          />
        </>
      )}

      {/* PO/DC tab filters */}
      {tab === 'podc' && (
        <>
          <FilterSelect
            label="Filter"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All backlog' },
              { value: 'disputed', label: 'Disputed' },
              { value: 'flagged', label: 'Flagged' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          <FilterSelect
            label="Sort by"
            value={filters.sort || 'days_desc'}
            options={[
              { value: 'days_desc', label: 'Days: High → Low' },
              { value: 'value_desc', label: 'Value: High → Low' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />
        </>
      )}

      {/* Invoice tab filters */}
      {tab === 'invoice' && (
        <>
          <FilterSelect
            label="Stage"
            value={filters.escalationStage || 'all'}
            options={[
              { value: 'all', label: 'All stages' },
              { value: '0', label: 'Pre-due' },
              { value: '1', label: 'Tier 1 (0–6d)' },
              { value: '2', label: 'Tier 2 (7–14d)' },
              { value: '3', label: 'Tier 3 (15–29d)' },
              { value: '4', label: 'Tier 4 (30d+)' },
            ]}
            onChange={(value) => onChange({ escalationStage: value })}
          />

          <FilterSelect
            label="Sort by"
            value={filters.sort || 'overdue_desc'}
            options={[
              { value: 'overdue_desc', label: 'Most overdue' },
              { value: 'balance_desc', label: 'Balance: High → Low' },
              { value: 'due_asc', label: 'Due date: Soonest' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />
        </>
      )}

      {/* Activity tab filters */}
      {tab === 'activity' && (
        <FilterSelect
          label="Source"
          value={filters.status || 'all'}
          options={[
            { value: 'all', label: 'All sources' },
            { value: 'quotation', label: 'Quotation' },
            { value: 'podc', label: 'PO/DC' },
            { value: 'invoice', label: 'Invoice' },
          ]}
          onChange={(value) => onChange({ status: value })}
        />
      )}

      {/* Lead tab filters */}
      {tab === 'lead' && (
        <>
          <FilterSelect
            label="Status"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All' },
              { value: 'New', label: 'New' },
              { value: 'Qualified', label: 'Qualified' },
              { value: 'On Hold', label: 'On Hold' },
              { value: 'Converted', label: 'Converted' },
              { value: 'Disqualified', label: 'Disqualified' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          <FilterSelect
            label="Sort by"
            value={filters.sort || 'newest_desc'}
            options={[
              { value: 'newest_desc', label: 'Newest first' },
              { value: 'oldest_asc', label: 'Oldest first' },
              { value: 'value_desc', label: 'Value: High → Low' },
              { value: 'next_action_asc', label: 'Next action: Soonest' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />
        </>
      )}

      {/* Procurement tab filters */}
      {tab === 'procurement' && (
        <>
          <FilterSelect
            label="Status"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending_inquiry', label: 'Inquiry' },
              { value: 'po_draft', label: 'Draft' },
              { value: 'pending_delivery', label: 'Pending Delivery' },
              { value: 'delayed', label: 'Delayed' },
              { value: 'completed', label: 'Completed' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          <FilterSelect
            label="Sort by"
            value={filters.sort || 'days_desc'}
            options={[
              { value: 'days_desc', label: 'Days Pending: High → Low' },
              { value: 'value_desc', label: 'Value: High → Low' },
            ]}
            onChange={(value) => onChange({ sort: value })}
          />
        </>
      )}

      {/* Reset button */}
      <button
        type="button"
        onClick={() => {
          onChange({
            status: 'all',
            expiringSoon: false,
            sort:
              tab === 'queue'
                ? 'priority_desc'
                : tab === 'quotation'
                  ? 'value_desc'
                  : tab === 'invoice'
                    ? 'overdue_desc'
                    : tab === 'lead'
                      ? 'newest_desc'
                      : 'days_desc',
            dateFrom: '',
            dateTo: '',
            escalationStage: 'all',
            assignee: 'all',
          });
          if (onQuickFilterChange) onQuickFilterChange('all');
          if (onFocusModeChange) onFocusModeChange(false);
        }}
        className="text-[10.5px] leading-none text-slate-500 hover:text-rose-600 px-1 py-0.5 transition flex-shrink-0 font-medium"
      >
        Reset
      </button>

      {/* Focus Mode Toggle */}
      {tab === 'queue' && focusMode !== undefined && onFocusModeChange && (
        <div className="flex items-center gap-1 ml-auto shrink-0 pl-1">
          <div className="h-3.5 w-px bg-slate-300 mx-1 hidden sm:block" />
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(e) => onFocusModeChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-transform after:duration-200 after:ease-out peer-checked:bg-blue-600"></div>
            <span className="ml-1 text-[10.5px] font-medium leading-none text-slate-700">Focus</span>
          </label>
        </div>
      )}
    </div>
  );
}