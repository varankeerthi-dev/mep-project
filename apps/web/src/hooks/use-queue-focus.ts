import { useMemo } from 'react';
import type { PriorityQueueItem } from '@/types/followup';

export type QuickFilter = 'all' | 'due_today' | 'overdue' | 'waiting' | 'upcoming' | 'unassigned';

/**
 * The five quick-filter predicates, shared by the focus filter and the
 * header counts. Behavior-preserving extraction from FollowUpCentre —
 * still label matching; the structured-field upgrade is a separate step.
 */
const QUICK_FILTER_PREDICATES: Record<Exclude<QuickFilter, 'all'>, (i: PriorityQueueItem) => boolean> = {
  due_today: (i) =>
    i.urgency_label.toLowerCase().includes('today') ||
    i.urgency_label.toLowerCase().includes('due tomorrow') ||
    i.urgency_label.toLowerCase().includes('tomorrow'),
  overdue: (i) =>
    i.urgency_label.toLowerCase().includes('overdue') ||
    i.urgency_label.toLowerCase().includes('delayed') ||
    i.urgency_label.toLowerCase().includes('days'),
  waiting: (i) =>
    i.reason.toLowerCase().includes('negotiation') ||
    i.reason.toLowerCase().includes('sent') ||
    i.urgency_label.toLowerCase().includes('validity'),
  upcoming: (i) =>
    i.urgency_label.toLowerCase().includes('upcoming') ||
    i.urgency_label.toLowerCase().includes('close') ||
    i.urgency_label.toLowerCase().includes('due'),
  unassigned: (i) => !i.assignee_user_id,
};

export interface QuickFilterCounts {
  due_today: number;
  overdue: number;
  waiting: number;
  upcoming: number;
  unassigned: number;
}

export function useQueueFocus(
  filteredQueue: PriorityQueueItem[],
  priorityQueue: PriorityQueueItem[],
  focusMode: boolean,
  quickFilter: QuickFilter
): { items: PriorityQueueItem[]; counts: QuickFilterCounts } {
  const items = useMemo(() => {
    let result = filteredQueue;

    // Focus mode: show only essentials (critical and high bands)
    if (focusMode) {
      result = result.filter((i) => i.priority_band === 'critical' || i.priority_band === 'high');
    }

    if (quickFilter !== 'all') {
      result = result.filter(QUICK_FILTER_PREDICATES[quickFilter]);
    }

    return result;
  }, [filteredQueue, focusMode, quickFilter]);

  const counts = useMemo<QuickFilterCounts>(
    () => ({
      due_today: priorityQueue.filter(QUICK_FILTER_PREDICATES.due_today).length,
      overdue: priorityQueue.filter(QUICK_FILTER_PREDICATES.overdue).length,
      waiting: priorityQueue.filter(QUICK_FILTER_PREDICATES.waiting).length,
      upcoming: priorityQueue.filter(QUICK_FILTER_PREDICATES.upcoming).length,
      unassigned: priorityQueue.filter(QUICK_FILTER_PREDICATES.unassigned).length,
    }),
    [priorityQueue]
  );

  return { items, counts };
}
