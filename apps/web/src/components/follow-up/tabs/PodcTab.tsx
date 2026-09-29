import { PodcBacklogRow, podcTableHeader } from '@/components/follow-up/podc-backlog-row';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { PodcBacklogItem, PodcIssueFlag } from '@/types/followup';

interface PodcTabProps {
  pagination: PaginationResult<PodcBacklogItem>;
  totalCount?: number;
  assignees: FollowUpAssigneeOption[];
  disabled: boolean;
  onSharePack: (item: PodcBacklogItem) => void;
  onOpenHistory: (item: PodcBacklogItem) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onFlagIssue: (item: PodcBacklogItem, issue: PodcIssueFlag) => void;
}

/**
 * PO/DC backlog tab. Extracted verbatim from FollowUpCentre's
 * renderTabContent — data fetching, mutations and history handling stay
 * in the page.
 */
export function PodcTab({
  pagination,
  totalCount,
  assignees,
  disabled,
  onSharePack,
  onOpenHistory,
  onAssigneeChange,
  onFlagIssue,
}: PodcTabProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50">
        {podcTableHeader}
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">No PO/DC backlog items match your filters.</p>
        ) : (
          pagination.currentItems.map((item) => (
            <PodcBacklogRow
              key={item.id}
              item={item}
              assignees={assignees}
              disabled={disabled}
              onSharePack={() => onSharePack(item)}
              onSelect={() => onOpenHistory(item)}
              onAssigneeChange={onAssigneeChange}
              onFlagIssue={(id, issue) => onFlagIssue(item, issue)}
            />
          ))
        )}
      </div>
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} totalCount={totalCount} />
    </div>
  );
}
