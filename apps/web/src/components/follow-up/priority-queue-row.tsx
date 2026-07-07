import { memo } from 'react';
import {
  ArrowRight,
  MessageCircle,
  MoreHorizontal,
  Square,
  CheckSquare,
  Phone,
  Mail,
  Clock,
  User,
} from 'lucide-react';
import type { PriorityQueueItem } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { resolveAssigneeLabel } from '@/hooks/use-followup-assignees';
import { SOURCE_TAB_LABELS } from '@/lib/followup/priority-queue';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { cn } from '@/lib/utils';

const DOT_STYLES: Record<PriorityQueueItem['priority_band'], string> = {
  critical: 'bg-red-600',
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-zinc-400',
};

const SOURCE_STYLES: Record<PriorityQueueItem['source_tab'], string> = {
  quotation: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  podc: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
  invoice: 'bg-sky-50 text-sky-800 border border-sky-100',
  lead: 'bg-violet-50 text-violet-800 border border-violet-100',
  procurement: 'bg-purple-50 text-purple-800 border border-purple-100',
};

type PriorityQueueRowProps = {
  item: PriorityQueueItem;
  rank: number;
  assignees: FollowUpAssigneeOption[];
  disabled?: boolean;
  onOpenSource: (item: PriorityQueueItem) => void;
  onQuickAction?: (item: PriorityQueueItem) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

export const PriorityQueueRow = memo(function PriorityQueueRow({
  item,
  rank,
  assignees,
  disabled,
  onOpenSource,
  onQuickAction,
  selected = false,
  onToggleSelect,
}: PriorityQueueRowProps) {
  const assigneeLabel = resolveAssigneeLabel(
    assignees,
    item.assignee_user_id,
    item.assignee_name
  );

  const assigneeRole = assignees.find(a => a.userId === item.assignee_user_id)?.role || 'Member';
  const isUnassigned = !item.assignee_user_id;
  const initials = assigneeLabel
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const renderActionIcon = () => {
    const tab = item.source_tab;
    const urgency = item.urgency_label.toLowerCase();
    if (tab === 'lead' || urgency.includes('call') || urgency.includes('phone') || urgency.includes('visit')) {
      return <Phone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
    }
    if (tab === 'invoice' || urgency.includes('mail') || urgency.includes('email') || urgency.includes('send') || urgency.includes('payment')) {
      return <Mail className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />;
    }
    return <Clock className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />;
  };

  const getTimelineBadge = () => {
    const label = item.urgency_label;
    const isOverdue = label.toLowerCase().includes('overdue') || label.toLowerCase().includes('days') || label.toLowerCase().includes('pending');
    const isToday = label.toLowerCase().includes('today');
    const isTomorrow = label.toLowerCase().includes('tomorrow');

    return (
      <span className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide",
        isOverdue ? "bg-red-50 text-red-700 border border-red-100" :
        isToday ? "bg-orange-50 text-orange-700 border border-orange-100" :
        isTomorrow ? "bg-blue-50 text-blue-700 border border-blue-100" :
        "bg-zinc-50 text-zinc-600 border border-zinc-200"
      )}>
        {isOverdue ? label.replace(' pending PO', '').replace(' pending vendor', '') : label}
      </span>
    );
  };

  const formatLastActivity = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (date.toDateString() === today.toDateString()) {
        return `Today ${timeStr}`;
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${timeStr}`;
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center border-b border-zinc-100 border-l-2 border-transparent bg-white px-4 py-3.5 transition-all duration-200 cursor-pointer',
        selected ? 'border-l-blue-600 bg-blue-50/40' : 'hover:border-l-blue-600 hover:bg-zinc-50/60'
      )}
      onClick={() => onToggleSelect?.(item.id)}
    >
      <div 
        className="w-[40px] shrink-0 flex items-center justify-center" 
        onClick={(e) => { 
          e.stopPropagation(); 
          onToggleSelect?.(item.id); 
        }}
      >
        <button type="button" className="text-zinc-400 hover:text-zinc-600 transition-colors">
          {selected ? (
            <CheckSquare className="h-[18px] w-[18px] text-blue-600 fill-blue-50/10" />
          ) : (
            <Square className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      <div className="w-[100px] shrink-0 flex items-center gap-2 px-2">
        <span className={cn('h-2 w-2 rounded-full shrink-0', DOT_STYLES[item.priority_band])} />
        <span className="text-sm font-semibold capitalize text-zinc-900">{item.priority_band}</span>
      </div>

      <div className="w-[160px] shrink-0 px-2 flex flex-col gap-1">
        <span className="text-sm font-semibold text-zinc-900 truncate" title={item.reference_label}>
          {item.reference_label}
        </span>
        <span className={cn(
          'inline-flex self-start items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          SOURCE_STYLES[item.source_tab]
        )}>
          {SOURCE_TAB_LABELS[item.source_tab]}
        </span>
      </div>

      <div className="w-[240px] shrink-0 px-2 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-zinc-800 truncate" title={item.client_name}>
          {item.client_name}
        </span>
        <span className="text-xs text-zinc-500 truncate" title={item.project_name}>
          {item.project_name || '—'}
        </span>
      </div>

      <div className="w-[260px] shrink-0 px-2 flex items-start gap-2">
        {renderActionIcon()}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-zinc-900 truncate" title={item.urgency_label}>
            {item.urgency_label}
          </span>
          <span className={cn(
            "text-xs truncate",
            item.priority_band === 'critical' || item.priority_band === 'high' ? "text-red-600 font-medium" : "text-zinc-500"
          )} title={item.reason}>
            {item.reason}
          </span>
        </div>
      </div>

      <div className="w-[130px] shrink-0 px-2 text-left flex flex-col gap-0.5">
        <span className="text-sm font-bold tabular-nums text-zinc-950">
          {formatFollowUpCurrency(item.amount)}
        </span>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          {item.source_tab === 'lead' ? 'Potential Revenue' : item.source_tab === 'quotation' ? 'Quoted' : item.source_tab === 'invoice' ? 'Invoice Value' : 'PO Value'}
        </span>
      </div>

      <div className="w-[120px] shrink-0 px-2 flex justify-center">
        {getTimelineBadge()}
      </div>

      <div className="w-[150px] shrink-0 px-2 flex items-center gap-2">
        <div className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm",
          isUnassigned ? "bg-zinc-100 text-zinc-500 border border-zinc-200" : "bg-zinc-100 text-blue-800 border border-blue-100"
        )}>
          {isUnassigned ? <User className="h-3.5 w-3.5" /> : initials}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-zinc-800 truncate" title={assigneeLabel}>
            {assigneeLabel}
          </span>
          <span className="text-[10px] text-zinc-500 capitalize truncate">
            {isUnassigned ? 'Unassigned' : assigneeRole}
          </span>
        </div>
      </div>

      <div className="w-[140px] shrink-0 px-2 text-xs font-medium text-zinc-500">
        {formatLastActivity(item.last_activity)}
      </div>

      <div className="w-[120px] shrink-0 flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {onQuickAction && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onQuickAction(item)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            title="Send reminder"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenSource(item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          title="Open Source"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors"
          title="More actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

export const priorityQueueTableHeader = (
  <div className="flex h-[38px] items-center px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 bg-zinc-50">
    <span className="w-[40px] shrink-0 text-center">#</span>
    <span className="w-[100px] shrink-0 text-left px-2">Priority</span>
    <span className="w-[160px] shrink-0 px-2 text-left">Entity / Reference</span>
    <span className="w-[240px] shrink-0 px-2 text-left">Client / Project</span>
    <span className="w-[260px] shrink-0 px-2 text-left">Next Action & Status</span>
    <span className="w-[130px] shrink-0 px-2 text-left">Amount</span>
    <span className="w-[120px] shrink-0 px-2 text-center">Timeline</span>
    <span className="w-[150px] shrink-0 px-2 text-left">Owner</span>
    <span className="w-[140px] shrink-0 px-2 text-left">Last Activity</span>
    <span className="w-[120px] shrink-0 text-center">Action</span>
  </div>
);
