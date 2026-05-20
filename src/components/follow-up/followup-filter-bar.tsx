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

export function FollowupFilterBar({ tab, filters, assignees = [], onChange }: FollowupFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tab !== 'activity' && (
        <select
          className={selectClass}
          value={filters.assignee}
          onChange={(e) => onChange({ assignee: e.target.value })}
          title="Filter by follow-up owner"
        >
          <option value="all">All assignees</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.label}
            </option>
          ))}
        </select>
      )}

      {tab === 'queue' && (
        <>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="all">All types</option>
            <option value="quotation">Quotations only</option>
            <option value="podc">PO/DC only</option>
            <option value="invoice">Invoices only</option>
          </select>
          <select
            className={selectClass}
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            <option value="priority_desc">Priority: High → Low</option>
            <option value="value_desc">Amount: High → Low</option>
            <option value="client_asc">Client: A → Z</option>
          </select>
        </>
      )}

      {tab === 'quotation' && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={filters.expiringSoon}
              onChange={(e) => onChange({ expiringSoon: e.target.checked })}
              className="rounded border-zinc-300"
            />
            Validity expiring soon
          </label>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="all">All statuses</option>
            <optgroup label="Active">
              <option value="sent">Sent</option>
              <option value="under_review">Under Review</option>
              <option value="in_negotiation">In Negotiation</option>
              <option value="pending">Pending</option>
              <option value="on_hold">On Hold</option>
            </optgroup>
            <optgroup label="Closed">
              <option value="approved">Approved</option>
              <option value="lost_to_competitor">Lost to Competitor</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </optgroup>
          </select>
          <select
            className={selectClass}
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            <option value="value_desc">Value: High → Low</option>
            <option value="value_asc">Value: Low → High</option>
            <option value="validity_asc">Validity: Soonest</option>
            <option value="submitted_desc">Submitted: Newest</option>
          </select>
          <input
            type="date"
            className={selectClass}
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            title="Submitted from"
          />
          <input
            type="date"
            className={selectClass}
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            title="Submitted to"
          />
        </>
      )}

      {tab === 'podc' && (
        <>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="all">All backlog</option>
            <option value="disputed">Disputed only</option>
            <option value="flagged">Flagged issues</option>
          </select>
          <select
            className={selectClass}
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            <option value="days_desc">Days pending: High → Low</option>
            <option value="value_desc">Value: High → Low</option>
          </select>
        </>
      )}

      {tab === 'invoice' && (
        <>
          <select
            className={selectClass}
            value={filters.escalationStage}
            onChange={(e) => onChange({ escalationStage: e.target.value })}
          >
            <option value="all">All stages</option>
            <option value="0">Pre-due</option>
            <option value="1">Tier 1 (0–6d)</option>
            <option value="2">Tier 2 (7–14d)</option>
            <option value="3">Tier 3 (15–29d)</option>
            <option value="4">Tier 4 (30d+)</option>
          </select>
          <select
            className={selectClass}
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            <option value="overdue_desc">Most overdue</option>
            <option value="balance_desc">Balance: High → Low</option>
            <option value="due_asc">Due date: Soonest</option>
          </select>
        </>
      )}

      {tab === 'activity' && (
        <select
          className={selectClass}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="all">All sources</option>
          <option value="quotation">Quotation</option>
          <option value="podc">PO/DC</option>
          <option value="invoice">Invoice</option>
        </select>
      )}

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
          'h-8 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600',
          'hover:bg-zinc-50'
        )}
      >
        Reset filters
      </button>
    </div>
  );
}
