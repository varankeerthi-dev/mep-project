import type { FollowUpFiltersState, FollowUpTab } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { cn } from '@/lib/utils';

type FollowupFilterBarProps = {
  tab: FollowUpTab;
  filters: FollowUpFiltersState;
  assignees?: FollowUpAssigneeOption[];
  onChange: (patch: Partial<FollowUpFiltersState>) => void;
};

const selectClass =
  'h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const chipClass = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
    active
      ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
      : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 hover:border-zinc-300'
  );

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={chipClass(active)}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn('min-w-[18px] h-4 rounded-full px-1 text-[9px] font-semibold', active ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 text-zinc-600')}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass, className)}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function FollowupFilterBar({ tab, filters, assignees = [], onChange }: FollowupFilterBarProps) {
  // Assignee filter - shown for all tabs except activity
  const assigneeOptions = [
    { value: 'all', label: 'All assignees' },
    { value: 'me', label: 'Assigned to me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...assignees.map((a) => ({ value: a.userId, label: a.label })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Assignee Filter */}
      {tab !== 'activity' && (
        <FilterSelect
          value={filters.assignee || 'all'}
          options={assigneeOptions}
          onChange={(value) => onChange({ assignee: value })}
          placeholder="Assignee"
        />
      )}

      {/* Priority Queue specific filters - Type + Sort as chips */}
      {tab === 'queue' && (
        <>
          {/* Type Filter Chips */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by source type">
            {[
              { value: 'all', label: 'All types' },
              { value: 'quotation', label: 'Quotations' },
              { value: 'podc', label: 'PO/DC' },
              { value: 'invoice', label: 'Invoices' },
            ].map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={filters.status === opt.value}
                onClick={() => onChange({ status: opt.value })}
              />
            ))}
          </div>

          {/* Sort Filter Chips */}
          <div className="flex items-center gap-1.5 ml-auto" role="group" aria-label="Sort queue">
            {[
              { value: 'priority_desc', label: 'Priority' },
              { value: 'value_desc', label: 'Amount' },
              { value: 'client_asc', label: 'Client' },
            ].map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={filters.sort === opt.value}
                onClick={() => onChange({ sort: opt.value })}
              />
            ))}
          </div>
        </>
      )}

      {/* Quotation tab filters */}
      {tab === 'quotation' && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.expiringSoon}
              onChange={(e) => onChange({ expiringSoon: e.target.checked })}
              className="rounded border-zinc-300 text-primary focus:ring-primary/20"
            />
            <span className="hover:text-zinc-900">Expiring ≤7d</span>
          </label>

          <FilterSelect
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
            placeholder="Status"
          />

          <FilterSelect
            value={filters.sort || 'value_desc'}
            options={[
              { value: 'value_desc', label: 'Value: High → Low' },
              { value: 'value_asc', label: 'Value: Low → High' },
              { value: 'validity_asc', label: 'Validity: Soonest' },
              { value: 'submitted_desc', label: 'Submitted: Newest' },
            ]}
            onChange={(value) => onChange({ sort: value })}
            placeholder="Sort"
          />

          <input
            type="date"
            className={selectClass}
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            title="Submitted from"
            placeholder="From"
          />
          <input
            type="date"
            className={selectClass}
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
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter PO/DC backlog">
            {[
              { value: 'all', label: 'All backlog' },
              { value: 'disputed', label: 'Disputed' },
              { value: 'flagged', label: 'Flagged' },
            ].map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={filters.status === opt.value}
                onClick={() => onChange({ status: opt.value })}
              />
            ))}
          </div>

          <FilterSelect
            value={filters.sort || 'days_desc'}
            options={[
              { value: 'days_desc', label: 'Days: High → Low' },
              { value: 'value_desc', label: 'Value: High → Low' },
            ]}
            onChange={(value) => onChange({ sort: value })}
            placeholder="Sort"
          />
        </>
      )}

      {/* Invoice tab filters */}
      {tab === 'invoice' && (
        <>
          <FilterSelect
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
            placeholder="Escalation"
          />

          <FilterSelect
            value={filters.sort || 'overdue_desc'}
            options={[
              { value: 'overdue_desc', label: 'Most overdue' },
              { value: 'balance_desc', label: 'Balance: High → Low' },
              { value: 'due_asc', label: 'Due date: Soonest' },
            ]}
            onChange={(value) => onChange({ sort: value })}
            placeholder="Sort"
          />
        </>
      )}

      {/* Activity tab filters */}
      {tab === 'activity' && (
        <FilterSelect
          value={filters.status || 'all'}
          options={[
            { value: 'all', label: 'All sources' },
            { value: 'quotation', label: 'Quotation' },
            { value: 'podc', label: 'PO/DC' },
            { value: 'invoice', label: 'Invoice' },
          ]}
          onChange={(value) => onChange({ status: value })}
          placeholder="Source"
        />
      )}

      {/* Reset button */}
      <button
        type="button"
        onClick={() =>
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
                    : 'days_desc',
            dateFrom: '',
            dateTo: '',
            escalationStage: 'all',
            assignee: 'all',
          })
        }
        className={cn(
          'h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600',
          'hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          'transition-colors duration-150'
        )}
      >
        Reset
      </button>
    </div>
  );
}