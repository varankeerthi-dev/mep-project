import {
  PriorityQueueBoard,
  type KanbanGroupBy,
} from '@/components/follow-up/priority-queue-board';
import {
  PriorityQueueRow,
} from '@/components/follow-up/priority-queue-row';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { PriorityQueueItem } from '@/types/followup';
import { formatCompactCurrency } from '@/lib/followup/currency-format';
import { CheckSquare, Square } from 'lucide-react';

interface QueueTabProps {
  pagination: PaginationResult<PriorityQueueItem>;
  /** Full focus-filtered list (for selection aggregates), not just the page. */
  focusedItems: PriorityQueueItem[];
  viewMode: 'table' | 'board';
  kanbanGroupBy: KanbanGroupBy;
  assignees: FollowUpAssigneeOption[];
  disabled: boolean;
  selectedRowIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (items: PriorityQueueItem[]) => void;
  onClearSelection: () => void;
  onOpenSource: (item: PriorityQueueItem) => void;
  onQuickAction: (item: PriorityQueueItem) => void;
}

/**
 * Priority queue tab (table + board modes). Extracted verbatim from
 * FollowUpCentre's renderTabContent — selection state, data fetching and
 * actions stay in the page.
 */
export function QueueTab({
  pagination,
  focusedItems,
  viewMode,
  kanbanGroupBy,
  assignees,
  disabled,
  selectedRowIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onOpenSource,
  onQuickAction,
}: QueueTabProps) {
  if (viewMode === 'board') {
    return (
      <div className="h-full min-h-0 flex-1 overflow-hidden pt-1">
        <PriorityQueueBoard
          items={focusedItems}
          groupBy={kanbanGroupBy}
          assignees={assignees}
          onOpenSource={onOpenSource}
          onQuickAction={onQuickAction}
          disabled={disabled}
        />
      </div>
    );
  }

  const isAllSelected = pagination.currentItems.length > 0 && pagination.currentItems.every(i => selectedRowIds.has(i.id));
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-[#f8fafc]">
        <div className="flex h-[42px] items-center pl-1.5 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
          <div className="w-7 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onSelectAll(pagination.currentItems)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-600 fill-blue-50/10" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          </div>
          <span className="w-[80px] shrink-0 px-2 text-left">Priority</span>
          <span className="w-[200px] shrink-0 px-2 text-left">Entity / Reference</span>
          <span className="w-[190px] shrink-0 px-3 text-left">Party / Project</span>
          <span className="w-[240px] shrink-0 px-2 text-left">Next Action & Status</span>
          <span className="w-[140px] shrink-0 px-2 text-left">Amount / Value</span>
          <span className="w-[110px] shrink-0 px-2 text-center">Timeline</span>
          <span className="w-[135px] shrink-0 px-2 text-left">Owner</span>
          <span className="w-[65px] shrink-0 text-center">Action</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {pagination.currentItems.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No follow-up items in the queue. Check other tabs or relax filters.
          </p>
        ) : (
          pagination.currentItems.map((item, index) => (
            <PriorityQueueRow
              key={item.id}
              item={item}
              rank={pagination.startIndex + index + 1}
              assignees={assignees}
              disabled={disabled}
              onOpenSource={onOpenSource}
              onQuickAction={onQuickAction}
              selected={selectedRowIds.has(item.id)}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
      {/* Bottom Aggregate Metrics Row - only shown when one or more rows are selected */}
      {selectedRowIds.size > 0 && (() => {
        const selectedItems = focusedItems.filter((i) => selectedRowIds.has(i.id));
        const selectedTotalValue = selectedItems.reduce((s, i) => s + (i.amount || 0), 0);
        const overdueItems = selectedItems.filter(
          (i) =>
            i.urgency_label.toLowerCase().includes('overdue') ||
            i.urgency_label.toLowerCase().includes('delayed')
        );
        return (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] leading-tight text-slate-600 select-none animate-in fade-in duration-150">
            <div className="flex items-center gap-4">
              <span className="font-medium text-slate-900">
                <span className="font-bold text-blue-600">{selectedItems.length}</span> {selectedItems.length === 1 ? 'record' : 'records'} selected
              </span>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>+ Sum of Total Value:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  {formatCompactCurrency(selectedTotalValue)}
                </span>
              </div>
              {overdueItems.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>+ Overdue Action Items:</span>
                    <span className="font-semibold text-rose-600 font-mono">
                      {overdueItems.length} ({formatCompactCurrency(overdueItems.reduce((s, i) => s + (i.amount || 0), 0))})
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition cursor-pointer"
              >
                Deselect all
              </button>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
              >
                + Add Calculation
              </button>
            </div>
          </div>
        );
      })()}
      <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} />
    </div>
  );
}
