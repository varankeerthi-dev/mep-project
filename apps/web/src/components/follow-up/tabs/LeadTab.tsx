import { LeadRow, leadTableHeader } from '@/components/follow-up/lead-row';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { Lead } from '@/types/leads';

interface LeadTabProps {
  pagination: PaginationResult<Lead>;
  disabled: boolean;
  onOpenHistory: (item: Lead) => void;
  onConvert: (id: string) => void;
  onDisqualify: (id: string) => void;
  onSetNextAction: (id: string, at: string | null, label: string) => void;
}

/**
 * Leads tab. Extracted verbatim from FollowUpCentre's renderTabContent —
 * data fetching, mutations and history handling stay in the page.
 */
export function LeadTab({
  pagination,
  disabled,
  onOpenHistory,
  onConvert,
  onDisqualify,
  onSetNextAction,
}: LeadTabProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50">
        {leadTableHeader}
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No leads match your filters.</p>
            <p className="mt-1 text-xs text-slate-500">Capture your first lead with the “New lead” button above.</p>
          </div>
        ) : (
          pagination.currentItems.map((item) => (
            <LeadRow
              key={item.id}
              item={item}
              disabled={disabled}
              onSelect={() => onOpenHistory(item)}
              onConvert={onConvert}
              onDisqualify={onDisqualify}
              onSetNextAction={onSetNextAction}
            />
          ))
        )}
      </div>
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} />
    </div>
  );
}
