import { memo } from 'react';
import {
  FileText,
  Truck,
  Receipt,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import type { FollowUpActivityLog } from '@/types/followup';
import { getActivityEventLabel } from '@/lib/followup/followup-formatters';
import { formatRelativeTime } from '@/lib/followup/date-format';
import { cn } from '@/lib/utils';

function EventIcon({ type }: { type: FollowUpActivityLog['event_type'] }) {
  const className = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'quotation_reminder_sent':
    case 'quotation_response_logged':
      return <FileText className={cn(className, 'text-indigo-600')} />;
    case 'podc_pack_shared':
      return <Truck className={cn(className, 'text-emerald-600')} />;
    case 'podc_issue_flagged':
      return <AlertTriangle className={cn(className, 'text-amber-600')} />;
    case 'invoice_reminder_sent':
      return <MessageCircle className={cn(className, 'text-sky-600')} />;
    case 'invoice_escalation_changed':
      return <TrendingUp className={cn(className, 'text-red-600')} />;
    default:
      return <Receipt className={className} />;
  }
}

type ActivityLogItemProps = {
  log: FollowUpActivityLog;
};

export const ActivityLogItem = memo(function ActivityLogItem({ log }: ActivityLogItemProps) {
  return (
    <div className="grid grid-cols-[24px_minmax(120px,1fr)_minmax(200px,2fr)_100px_120px] items-start gap-3 border-b border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50/60">
      <EventIcon type={log.event_type} />
      <div>
        <p className="font-medium text-zinc-900">{log.title}</p>
        <p className="text-[10px] text-zinc-500">{getActivityEventLabel(log.event_type)}</p>
      </div>
      <p className="text-zinc-600 line-clamp-2">{log.description}</p>
      <span className="font-mono text-[11px] text-indigo-700">{log.reference_label}</span>
      <div className="text-right">
        <p className="text-[11px] text-zinc-700">{log.actor_name}</p>
        <p className="text-[10px] text-zinc-400">{formatRelativeTime(log.created_at)}</p>
      </div>
    </div>
  );
});

export const activityTableHeader = (
  <div className="grid grid-cols-[24px_minmax(120px,1fr)_minmax(200px,2fr)_100px_120px] gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
    <span />
    <span>Event</span>
    <span>Description</span>
    <span>Reference</span>
    <span className="text-right">Actor / time</span>
  </div>
);
