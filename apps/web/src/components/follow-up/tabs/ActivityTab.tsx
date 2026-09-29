import { ActivityLogItem, activityTableHeader } from '@/components/follow-up/activity-log-item';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { FollowUpActivityLog } from '@/types/followup';

interface ActivityTabProps {
  pagination: PaginationResult<FollowUpActivityLog>;
}

/**
 * Activity log tab. Extracted verbatim from FollowUpCentre's renderTabContent.
 */
export function ActivityTab({ pagination }: ActivityTabProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50">
        {activityTableHeader}
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">No activity logs match your filters.</p>
        ) : (
          pagination.currentItems.map((item) => (
            <ActivityLogItem key={item.id} log={item} />
          ))
        )}
      </div>
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} />
    </div>
  );
}
