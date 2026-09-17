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
} from 'lucide-react';
import type { PriorityQueueItem } from '@/types/followup';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import { resolveAssigneeLabel } from '@/hooks/use-followup-assignees';
import { SOURCE_TAB_LABELS } from '@/lib/followup/priority-queue';
import { formatFollowUpCurrency } from '@/lib/followup/currency-format';
import { cn } from '@/lib/utils';

const DOT_STYLES: Record<PriorityQueueItem['priority_band'], string> = {
  critical: 'bg-red-700',
  high: 'bg-amber-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

const SOURCE_STYLES: Record<PriorityQueueItem['source_tab'], string> = {
  quotation: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  podc: 'bg-teal-50 text-teal-700 border border-teal-200',
  invoice: 'bg-sky-100 text-sky-800 border border-sky-200',
  lead: 'bg-blue-50 text-blue-700 border border-blue-200',
  procurement: 'bg-slate-100 text-slate-700 border border-slate-200',
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
      return <Mail className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
    }
    return <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />;
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
        isToday ? "bg-amber-50 text-amber-700 border border-amber-100" :
        isTomorrow ? "bg-blue-50 text-blue-700 border border-blue-100" :
        "bg-slate-50 text-slate-600 border border-slate-200"
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
        'group flex items-center border-b border-slate-200 border-l-2 border-transparent bg-white pl-1.5 pr-4 py-2.5 transition-colors duration-150 cursor-pointer',
        selected
          ? 'border-l-blue-600 bg-[#f0f7ff]'
          : item.priority_band === 'critical'
            ? 'bg-rose-50/30 hover:bg-rose-50/50'
            : 'hover:bg-slate-50'
      )}
      onClick={() => onToggleSelect?.(item.id)}
    >
      <div 
        className="w-7 shrink-0 flex items-center justify-center" 
        onClick={(e) => { 
          e.stopPropagation(); 
          onToggleSelect?.(item.id); 
        }}
      >
        <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors">
          {selected ? (
            <CheckSquare className="h-4 w-4 text-blue-600 fill-blue-50/10" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="w-[80px] shrink-0 px-2 flex items-center">
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize',
          item.priority_band === 'critical' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
          item.priority_band === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          item.priority_band === 'medium' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
          'bg-sky-50 text-sky-700 border border-sky-200'
        )}>
          {item.priority_band === 'low' ? 'Normal' : item.priority_band}
        </span>
      </div>

      <div className="w-[200px] shrink-0 px-2 flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors shrink-0" title={item.reference_label}>
          {item.reference_label}
        </span>
        <span className={cn(
          'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
          SOURCE_STYLES[item.source_tab]
        )}>
          {item.source_tab === 'podc' ? 'PO/DC GAP' : SOURCE_TAB_LABELS[item.source_tab].toUpperCase()}
        </span>
      </div>

      <div className="w-[190px] shrink-0 px-3 flex flex-col justify-center min-w-0">
        <span className="text-xs font-semibold text-slate-900 truncate" title={item.client_name}>
          {item.client_name}
        </span>
        <span className="text-[11px] text-slate-500 truncate" title={item.project_name}>
          {item.project_name || '—'}
        </span>
      </div>

      <div className="w-[240px] shrink-0 px-2 flex items-center gap-2 min-w-0">
        {renderActionIcon()}
        <span className={cn(
          "text-xs truncate font-medium",
          item.priority_band === 'critical' ? "text-rose-600" :
          item.urgency_label.toLowerCase().includes('received') ? "text-amber-700" :
          item.urgency_label.toLowerCase().includes('review') ? "text-emerald-700" :
          "text-blue-600"
        )} title={item.urgency_label}>
          {item.urgency_label}
        </span>
      </div>

      <div className="w-[140px] shrink-0 px-2 text-left flex items-baseline gap-1.5 min-w-0">
        <span className="text-xs font-semibold tabular-nums text-slate-900 tracking-tight">
          {formatFollowUpCurrency(item.amount)}
        </span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {item.source_tab === 'lead' ? 'EST. VALUE' : item.source_tab === 'quotation' ? 'QUOTED' : item.source_tab === 'invoice' ? 'INVOICE' : item.source_tab === 'procurement' ? 'BUDGET' : 'PO VALUE'}
        </span>
      </div>

      <div className="w-[110px] shrink-0 px-2 flex justify-center">
        {getTimelineBadge()}
      </div>

      <div className="w-[135px] shrink-0 px-2 flex items-center gap-2 min-w-0">
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
          isUnassigned 
            ? "bg-slate-50 text-slate-400 border border-slate-300" 
            : "bg-blue-50 text-blue-700 border border-blue-200"
        )}>
          {isUnassigned ? '?' : initials}
        </div>
        <span className={cn(
          "text-xs truncate",
          isUnassigned ? "italic text-slate-400" : "font-medium text-slate-800"
        )} title={assigneeLabel}>
          {assigneeLabel}
        </span>
      </div>

      <div className="w-[65px] shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onOpenSource(item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          title="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

export const priorityQueueTableHeader = (
  <div className="flex h-[42px] items-center pl-1.5 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-normal border-b border-slate-200 bg-[#f8fafc] select-none">
    <span className="w-7 shrink-0 text-center">#</span>
    <span className="w-[80px] shrink-0 px-2 text-left">Priority</span>
    <span className="w-[200px] shrink-0 px-2 text-left">Entity / Reference</span>
    <span className="w-[190px] shrink-0 px-3 text-left">Party / Project</span>
    <span className="w-[240px] shrink-0 px-2 text-left">Next Action & Status</span>
    <span className="w-[140px] shrink-0 px-2 text-left">Amount / Value</span>
    <span className="w-[110px] shrink-0 px-2 text-center">Timeline</span>
    <span className="w-[135px] shrink-0 px-2 text-left">Owner</span>
    <span className="w-[65px] shrink-0 text-center">Action</span>
  </div>
);
