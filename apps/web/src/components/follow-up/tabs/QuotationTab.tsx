import {
  QuotationFollowupRow,
  quotationTableHeader,
} from '@/components/follow-up/quotation-followup-row';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { QuotationFollowUp, QuotationResponseOption } from '@/types/followup';

interface QuotationTabProps {
  pagination: PaginationResult<QuotationFollowUp>;
  totalCount?: number;
  assignees: FollowUpAssigneeOption[];
  disabled: boolean;
  onReminder: (item: QuotationFollowUp) => void;
  onOpenHistory: (item: QuotationFollowUp) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onLogResponse: (item: QuotationFollowUp, response: QuotationResponseOption) => void;
}

/**
 * Quotations tab. Extracted verbatim from FollowUpCentre's renderTabContent —
 * data fetching, mutations and history handling stay in the page.
 */
export function QuotationTab({
  pagination,
  totalCount,
  assignees,
  disabled,
  onReminder,
  onOpenHistory,
  onAssigneeChange,
  onLogResponse,
}: QuotationTabProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50">
        {quotationTableHeader}
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">No quotations match your filters.</p>
        ) : (
          pagination.currentItems.map((item) => (
            <QuotationFollowupRow
              key={item.id}
              item={item}
              assignees={assignees}
              disabled={disabled}
              onReminder={() => onReminder(item)}
              onSelect={() => onOpenHistory(item)}
              onAssigneeChange={onAssigneeChange}
              onLogResponse={(id, response) => onLogResponse(item, response)}
            />
          ))
        )}
      </div>
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} totalCount={totalCount} />
    </div>
  );
}
