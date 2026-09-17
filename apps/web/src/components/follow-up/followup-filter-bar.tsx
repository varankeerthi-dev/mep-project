import { ChevronDown, LayoutList, Columns3 } from 'lucide-react';
import type { FollowUpFiltersState, FollowUpTab } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { KanbanGroupBy } from '@/components/follow-up/priority-queue-board';
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
  viewMode?: 'table' | 'board';
  onViewModeChange?: (mode: 'table' | 'board') => void;
  kanbanGroupBy?: KanbanGroupBy;
  onKanbanGroupByChange?: (group: KanbanGroupBy) => void;
};

const dateInputClass =
  'h-[30px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors duration-150 shadow-2xs shrink-0';

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
        'relative inline-flex items-center gap-1.5 h-[30px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer select-none group shrink-0',
        className
      )}
    >
      {label && <span className="text-slate-400 font-normal">{label}:</span>}
      <span className="font-semibold text-slate-800 truncate max-w-[130px]">{displayLabel}</span>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors ml-0.5" />
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
  viewMode = 'table',
  onViewModeChange,
  kanbanGroupBy = 'priority',
  onKanbanGroupByChange,
}: FollowupFilterBarProps) {
  // Assignee filter - shown for all tabs except activity
  const assigneeOptions = [
    { value: 'all', label: 'All' },
    { value: 'me', label: 'Assigned to me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...assignees.map((a) => ({ value: a.userId, label: a.label })),
  ];

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 flex-nowrap">
      {/* Assignee Filter */}
      {tab !== 'activity' && (
        <FilterSelect
          label="Assignee"
          value={filters.assignee || 'all'}
          options={assigneeOptions}
          onChange={(value) => onChange({ assignee: value })}
        />
      )}

      {/* Priority Queue specific filters: Dropdowns next-to-next, followed by Quick Filters */}
      {tab === 'queue' && (
        <>
          {/* Type Dropdown */}
          <FilterSelect
            label="Type"
            value={filters.status || 'all'}
            options={[
              { value: 'all', label: 'All' },
              { value: 'quotation', label: 'Quotations' },
              { value: 'podc', label: 'PO/DC' },
              { value: 'invoice', label: 'Invoices' },
              { value: 'lead', label: 'Leads' },
              { value: 'procurement', label: 'Procurement' },
            ]}
            onChange={(value) => onChange({ status: value })}
          />

          {/* Stage Dropdown */}
          <FilterSelect
            label="Stage"
            value={filters.escalationStage || 'any'}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Normal' },
            ]}
            onChange={(value) => onChange({ escalationStage: value })}
          />

          {/* Activity Dropdown */}
          <FilterSelect
            label="Activity"
            value={filters.dateFrom || '90d'}
            options={[
              { value: '90d', label: '90d' },
              { value: '30d', label: '30d' },
              { value: '7d', label: '7d' },
              { value: 'today', label: 'Today' },
              { value: 'all', label: 'All time' },
            ]}
            onChange={(value) => onChange({ dateFrom: value })}
          />

          {/* Group by dropdown when in Kanban Board view */}
          {viewMode === 'board' && onKanbanGroupByChange && (
            <FilterSelect
              label="Group by"
              value={kanbanGroupBy}
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'category', label: 'Category' },
                { value: 'party_type', label: 'Party Type' },
                { value: 'timeline', label: 'Timeline' },
                { value: 'assignee', label: 'Assignee' },
              ]}
              onChange={(v) => onKanbanGroupByChange(v as KanbanGroupBy)}
            />
          )}

          {/* Divider between Dropdowns and Quick Filters */}
          {onQuickFilterChange && <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />}

          {/* Quick Filter Pills next-to-next */}
          {onQuickFilterChange && (
            <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Priority Queue Quick Filters">
              {[
                { value: 'all', label: 'All', count: queueTotalCount },
                { value: 'due_today', label: 'Due Today', count: quickFilterCounts?.due_today, variant: 'warning' },
                { value: 'overdue', label: 'Overdue Items', count: quickFilterCounts?.overdue, variant: 'urgent' },
                { value: 'waiting', label: 'Waiting', count: quickFilterCounts?.waiting },
                { value: 'upcoming', label: 'Upcoming', count: quickFilterCounts?.upcoming },
                { value: 'unassigned', label: 'Unassigned', count: quickFilterCounts?.unassigned },
              ].map((item) => {
                const isSelected = quickFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onQuickFilterChange(item.value as any)}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg text-xs font-medium transition cursor-pointer select-none shrink-0 shadow-2xs',
                      isSelected
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span>{item.label}</span>
                    {typeof item.count === 'number' && (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold leading-none',
                          isSelected
                            ? 'bg-blue-200/70 text-blue-800'
                            : item.variant === 'urgent' && item.count > 0
                            ? 'bg-rose-100 text-rose-700'
                            : item.variant === 'warning' && item.count > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
        className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 transition flex-shrink-0 font-medium cursor-pointer"
      >
        Reset
      </button>
    </div>
  );
}