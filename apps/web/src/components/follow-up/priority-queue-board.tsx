import { memo, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PriorityQueueItem, PriorityBand } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { resolveAssigneeLabel } from '@/hooks/use-followup-assignees';
import { SOURCE_TAB_LABELS } from '@/lib/followup/priority-queue';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { useAssignFollowUp, useUpdateFollowUpPriority } from '@/hooks/use-followup-data';
import {
  GenericKanbanBoard,
  KanbanCardRoot,
  KanbanCardHeader,
  KanbanCardTitle,
  KanbanCardStatus,
  KanbanCardFooter,
  KanbanBadge,
  KanbanAvatar,
  type KanbanColumn,
  type KanbanMoveEvent,
} from '@/components/ui/kanban';

export type KanbanGroupBy = 'priority' | 'category' | 'party_type' | 'timeline' | 'assignee';

export interface PriorityQueueBoardProps {
  items: PriorityQueueItem[];
  groupBy: KanbanGroupBy;
  assignees?: FollowUpAssigneeOption[];
  onOpenSource: (item: PriorityQueueItem) => void;
  onQuickAction?: (item: PriorityQueueItem) => void;
  disabled?: boolean;
}

const SOURCE_STYLES: Record<PriorityQueueItem['source_tab'], string> = {
  quotation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  podc: 'bg-teal-50 text-teal-700 border-teal-200',
  invoice: 'bg-sky-100 text-sky-800 border-sky-200',
  lead: 'bg-blue-50 text-blue-700 border-blue-200',
  procurement: 'bg-slate-100 text-slate-700 border-slate-200',
};

const PRIORITY_VARIANTS: Record<PriorityBand, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

function resolvePartyType(item: PriorityQueueItem): 'client' | 'vendor' | 'subcontractor' {
  if (item.source_tab === 'procurement') return 'vendor';
  const text = (item.reason + ' ' + item.project_name + ' ' + item.reference_label).toLowerCase();
  if (text.includes('subcon') || text.includes('sub-contract') || text.includes('subcontractor')) {
    return 'subcontractor';
  }
  return 'client';
}

function resolveTimelineBucket(item: PriorityQueueItem): 'overdue' | 'today' | 'waiting' | 'upcoming' {
  const urgency = item.urgency_label.toLowerCase();
  if (urgency.includes('overdue') || urgency.includes('delayed') || urgency.includes('days')) {
    return 'overdue';
  }
  if (urgency.includes('today') || urgency.includes('tomorrow')) {
    return 'today';
  }
  if (
    item.reason.toLowerCase().includes('negotiation') ||
    item.reason.toLowerCase().includes('sent') ||
    urgency.includes('validity')
  ) {
    return 'waiting';
  }
  return 'upcoming';
}

export const PriorityQueueCard = memo(function PriorityQueueCard({
  item,
  assignees = [],
  onOpenSource,
  disabled,
  isDragging = false,
  isOverlay = false,
}: {
  item: PriorityQueueItem;
  assignees?: FollowUpAssigneeOption[];
  onOpenSource: (item: PriorityQueueItem) => void;
  onQuickAction?: (item: PriorityQueueItem) => void;
  disabled?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
}) {
  const assigneeLabel = resolveAssigneeLabel(
    assignees,
    item.assignee_user_id,
    item.assignee_name
  );
  const isUnassigned = !item.assignee_user_id;
  const initials =
    assigneeLabel
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  const label = item.urgency_label;
  const isOverdue =
    label.toLowerCase().includes('overdue') ||
    label.toLowerCase().includes('delayed') ||
    label.toLowerCase().includes('pending');
  const isToday = label.toLowerCase().includes('today') || label.toLowerCase().includes('tomorrow');

  const statusTone =
    item.priority_band === 'critical' || isOverdue
      ? 'danger'
      : isToday
        ? 'warning'
        : 'default';

  const amountLabel =
    item.source_tab === 'lead'
      ? 'EST'
      : item.source_tab === 'quotation'
        ? 'QUOTED'
        : item.source_tab === 'invoice'
          ? 'INV'
          : item.source_tab === 'procurement'
            ? 'PO'
            : 'VAL';

  return (
    <KanbanCardRoot
      onClick={() => onOpenSource(item)}
      isDragging={isDragging}
      isOverlay={isOverlay}
    >
      {/* Top Row: Document Reference + Category Tag + Priority Badge */}
      <KanbanCardHeader
        referenceId={item.reference_label}
        categoryTag={item.source_tab === 'podc' ? 'PO GAP' : SOURCE_TAB_LABELS[item.source_tab].toUpperCase()}
        categoryClassName={SOURCE_STYLES[item.source_tab]}
        badge={
          <KanbanBadge variant={PRIORITY_VARIANTS[item.priority_band]}>
            {item.priority_band === 'low' ? 'Normal' : item.priority_band}
          </KanbanBadge>
        }
      />

      {/* Party & Project Row */}
      <KanbanCardTitle
        primary={item.client_name}
        secondary={item.project_name || '—'}
      />

      {/* Action / Urgency Row: Icon-free typography banner */}
      <KanbanCardStatus tone={statusTone}>
        {item.urgency_label}
      </KanbanCardStatus>

      {/* Bottom Row: Amount (Strictly Left-Aligned) + Timeline Tag + Initials Avatar */}
      <KanbanCardFooter
        amount={formatFollowUpCurrency(item.amount)}
        amountLabel={amountLabel}
        tag={
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-tight border',
              isOverdue
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isToday
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            )}
          >
            {label.replace(' pending PO', '').replace(' pending vendor', '')}
          </span>
        }
        avatar={
          <KanbanAvatar
            initials={initials}
            title={assigneeLabel}
            isUnassigned={isUnassigned}
          />
        }
      />
    </KanbanCardRoot>
  );
});

export function PriorityQueueBoard({
  items,
  groupBy,
  assignees = [],
  onOpenSource,
  onQuickAction,
  disabled = false,
}: PriorityQueueBoardProps) {
  const assignFollowUp = useAssignFollowUp();
  const updatePriority = useUpdateFollowUpPriority();

  // Columns definition based on groupBy
  const columns: KanbanColumn<PriorityQueueItem>[] = useMemo(() => {
    switch (groupBy) {
      case 'priority': {
        const bands: { id: PriorityBand; title: string; badgeClass: string }[] = [
          { id: 'critical', title: 'Critical', badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200' },
          { id: 'high', title: 'High', badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200' },
          { id: 'medium', title: 'Medium', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
          { id: 'low', title: 'Normal', badgeClass: 'bg-slate-50 text-slate-700 border border-slate-300' },
        ];
        return bands.map((b) => {
          const colItems = items.filter((i) => i.priority_band === b.id);
          return {
            id: b.id,
            title: b.title,
            badgeClass: b.badgeClass,
            items: colItems,
            totalValue: colItems.reduce((s, i) => s + (i.amount || 0), 0),
          };
        });
      }
      case 'timeline': {
        const buckets = [
          { id: 'overdue', title: 'Overdue', badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200' },
          { id: 'today', title: 'Due Today / Tomorrow', badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200' },
          { id: 'waiting', title: 'Waiting / In Review', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300' },
          { id: 'upcoming', title: 'Upcoming', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
        ];
        return buckets.map((b) => {
          const colItems = items.filter((i) => resolveTimelineBucket(i) === b.id);
          return {
            id: b.id,
            title: b.title,
            badgeClass: b.badgeClass,
            items: colItems,
            totalValue: colItems.reduce((s, i) => s + (i.amount || 0), 0),
          };
        });
      }
      case 'category': {
        const tabs: { id: PriorityQueueItem['source_tab']; title: string; badgeClass: string }[] = [
          { id: 'lead', title: 'Leads', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
          { id: 'quotation', title: 'Quotations', badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
          { id: 'podc', title: 'PO/DC Backlog', badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200' },
          { id: 'invoice', title: 'Invoices', badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200' },
          { id: 'procurement', title: 'Procurement', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300' },
        ];
        return tabs.map((t) => {
          const colItems = items.filter((i) => i.source_tab === t.id);
          return {
            id: t.id,
            title: t.title,
            badgeClass: t.badgeClass,
            items: colItems,
            totalValue: colItems.reduce((s, i) => s + (i.amount || 0), 0),
          };
        });
      }
      case 'party_type': {
        const parties = [
          { id: 'client', title: 'Clients', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
          { id: 'vendor', title: 'Vendors', badgeClass: 'bg-teal-50 text-teal-700 border border-teal-200' },
          { id: 'subcontractor', title: 'Sub-contractors', badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200' },
        ];
        return parties.map((p) => {
          const colItems = items.filter((i) => resolvePartyType(i) === p.id);
          return {
            id: p.id,
            title: p.title,
            badgeClass: p.badgeClass,
            items: colItems,
            totalValue: colItems.reduce((s, i) => s + (i.amount || 0), 0),
          };
        });
      }
      case 'assignee': {
        const map = new Map<string, PriorityQueueItem[]>();
        const unassigned: PriorityQueueItem[] = [];

        items.forEach((i) => {
          if (!i.assignee_user_id) {
            unassigned.push(i);
          } else {
            const list = map.get(i.assignee_user_id) || [];
            list.push(i);
            map.set(i.assignee_user_id, list);
          }
        });

        const res: KanbanColumn<PriorityQueueItem>[] = [];
        // Add known assignees
        assignees.forEach((a) => {
          const userItems = map.get(a.userId) || [];
          res.push({
            id: a.userId,
            title: a.label,
            badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
            items: userItems,
            totalValue: userItems.reduce((s, i) => s + (i.amount || 0), 0),
          });
        });

        // Add Unassigned column
        res.push({
          id: 'unassigned',
          title: 'Unassigned',
          badgeClass: 'bg-slate-100 text-slate-600 border border-slate-300',
          items: unassigned,
          totalValue: unassigned.reduce((s, i) => s + (i.amount || 0), 0),
        });

        return res;
      }
      default:
        return [];
    }
  }, [items, groupBy, assignees]);

  // Handle Drag and Move between columns using RPC mutations
  const handleItemMove = useCallback(
    async ({ item, sourceColumnId, destinationColumnId }: KanbanMoveEvent<PriorityQueueItem>) => {
      if (sourceColumnId === destinationColumnId) return;

      if (groupBy === 'assignee') {
        const newAssigneeId = destinationColumnId === 'unassigned' ? null : destinationColumnId;
        const targetAssigneeLabel =
          newAssigneeId === null
            ? 'Unassigned'
            : assignees.find((a) => a.userId === newAssigneeId)?.label || 'Assignee';

        try {
          await assignFollowUp.mutateAsync({
            source: item.source_tab,
            sourceId: item.source_id,
            assigneeUserId: newAssigneeId,
          });
          toast.success(
            newAssigneeId
              ? `Reassigned ${item.reference_label} to ${targetAssigneeLabel}`
              : `Unassigned ${item.reference_label}`
          );
        } catch (err: any) {
          toast.error(`Failed to reassign: ${err?.message || 'Error occurred'}`);
        }
      } else if (groupBy === 'priority') {
        const band = destinationColumnId as PriorityBand;
        const bandTitle =
          band === 'critical'
            ? 'Critical'
            : band === 'high'
              ? 'High'
              : band === 'medium'
                ? 'Medium'
                : 'Normal';

        try {
          await updatePriority.mutateAsync({
            source: item.source_tab,
            sourceId: item.source_id,
            priorityBand: band,
            referenceLabel: item.reference_label,
          });
          toast.success(`Updated ${item.reference_label} priority to ${bandTitle}`);
        } catch (err: any) {
          toast.error(`Failed to update priority: ${err?.message || 'Error occurred'}`);
        }
      } else {
        toast.info(
          `${item.reference_label} belongs to ${item.source_tab.toUpperCase()}. Click card to view details.`
        );
      }
    },
    [groupBy, assignees, assignFollowUp, updatePriority]
  );

  return (
    <GenericKanbanBoard<PriorityQueueItem>
      columns={columns}
      getItemId={(item) => item.id}
      renderCard={(item, { isDragging }) => (
        <PriorityQueueCard
          item={item}
          assignees={assignees}
          onOpenSource={onOpenSource}
          onQuickAction={onQuickAction}
          disabled={disabled}
          isDragging={isDragging}
        />
      )}
      renderDragOverlay={(item) => (
        <PriorityQueueCard
          item={item}
          assignees={assignees}
          onOpenSource={() => {}}
          disabled
          isOverlay
        />
      )}
      onItemMove={handleItemMove}
      formatColumnTotal={(val) => formatFollowUpCurrency(val)}
      columnWidthClassName="w-72 sm:w-80"
      disabled={disabled}
      boardEmptyState={
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <p className="text-sm font-bold text-slate-700">No items in the Priority Queue</p>
          <p className="text-xs text-slate-500 mt-1">Adjust your filters or check other tabs.</p>
        </div>
      }
    />
  );
}
