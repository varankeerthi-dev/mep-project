import {
  ProcurementFollowupRow,
  procurementTableHeader,
} from '@/components/follow-up/procurement-followup-row';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { ProcurementFollowUp } from '@/types/followup';

interface ProcurementTabProps {
  pagination: PaginationResult<ProcurementFollowUp>;
  assignees: FollowUpAssigneeOption[];
  disabled: boolean;
  onReminder: (item: ProcurementFollowUp) => void;
  onOpenHistory: (item: ProcurementFollowUp) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
}

/**
 * Procurement tab. Extracted verbatim from FollowUpCentre's
 * renderTabContent — data fetching, mutations and history handling stay
 * in the page.
 */
export function ProcurementTab({
  pagination,
  assignees,
  disabled,
  onReminder,
  onOpenHistory,
  onAssigneeChange,
}: ProcurementTabProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50">
        {procurementTableHeader}
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">No procurement items match your filters.</p>
        ) : (
          pagination.currentItems.map((item) => (
            <ProcurementFollowupRow
              key={item.id}
              item={item}
              assignees={assignees}
              disabled={disabled}
              onReminder={() => onReminder(item)}
              onSelect={() => onOpenHistory(item)}
              onAssigneeChange={onAssigneeChange}
            />
          ))
        )}
      </div>
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} />
    </div>
  );
}
