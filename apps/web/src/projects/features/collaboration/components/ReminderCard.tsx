// ReminderCard.tsx — system message card referencing a Reminder.
import { Bell, Clock, CheckCircle2 } from 'lucide-react';
import { formatRelativeTime } from '../utils';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export function ReminderCard({ message }: Props) {
  const entity = message.metadata?.linked_entities?.[0];
  const meta = (entity?.snapshot ?? (entity as any)?.meta ?? {}) as Record<string, any>;

  const title = meta.title || entity?.label || message.content.replace(/^Reminder set:\s*/, '') || 'Reminder';
  const remindAt = meta.remind_at as string | undefined;
  const status = (meta.status as string) || 'pending';
  const recipientName = meta.recipient_name as string | undefined;

  const isCompleted = status === 'completed';

  return (
    <div
      className="my-1.5 border border-purple-200/80 rounded-lg bg-gradient-to-br from-purple-50/40 to-slate-50/60 p-3 max-w-md shadow-xs"
      data-testid="collab-reminder-card"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-purple-800">
          <Bell className="h-4 w-4 text-purple-600 shrink-0" />
          <span>Reminder</span>
          <span className="text-gray-400 font-normal">· {formatRelativeTime(message.created_at)}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            isCompleted
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}
        >
          {isCompleted ? 'Completed' : 'Pending'}
        </span>
      </div>

      <div className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">
        {title}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 text-slate-500">
        <div className="flex items-center gap-2">
          {remindAt ? (
            <span className="flex items-center gap-1 text-[11px] text-purple-700 font-medium">
              <Clock className="h-3 w-3" />
              {new Date(remindAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">No scheduled time (anytime)</span>
          )}
        </div>

        {recipientName && (
          <span className="text-[11px] text-slate-600">
            For: <span className="font-medium text-slate-800">{recipientName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
