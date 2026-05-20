import { useItemHistory } from '../../hooks/use-item-history';
import type { LinkedItemType, UnifiedTimelineEntry } from '../../types/followup';
import { Loader2, MessageSquare, AlertCircle, Clock } from 'lucide-react';

type ItemHistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  organisationId: string | undefined;
  linkedType: LinkedItemType | undefined;
  linkedId: string | undefined;
  itemLabel: string;
  clientName: string;
  followUpStatus?: string;
  onLogCommunication?: () => void;
};

function SourceBadge({ entry }: { entry: UnifiedTimelineEntry }) {
  if (entry.source === 'follow_up') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
        <Clock className="w-3 h-3" /> Follow-Up
      </span>
    );
  }
  const callType = entry.metadata?.call_type || 'Communication';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
      <MessageSquare className="w-3 h-3" /> {callType}
    </span>
  );
}

function formatEntryDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-8 h-8 text-zinc-300 mb-2" />
      <p className="text-sm text-zinc-500">No activity yet</p>
      <p className="text-xs text-zinc-400 mt-1">Follow-up actions and client communications will appear here</p>
    </div>
  );
}

export function ItemHistoryDrawer({
  open,
  onClose,
  organisationId,
  linkedType,
  linkedId,
  itemLabel,
  clientName,
  followUpStatus,
  onLogCommunication,
}: ItemHistoryDrawerProps) {
  const { data: entries, isLoading } = useItemHistory(organisationId, linkedType, linkedId);

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 z-50 h-full w-96 border-l border-zinc-200 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{itemLabel}</p>
          <p className="text-xs text-zinc-500 truncate">{clientName}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {followUpStatus && (
        <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <span className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wide">Status</span>
          <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-700">
            {followUpStatus}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={entry.id} className="relative pl-5">
                {i < entries.length - 1 && (
                  <div className="absolute left-[7px] top-5 bottom-0 w-px bg-zinc-200" />
                )}
                <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-200 bg-white" />
                <div className="flex items-center gap-2 mb-1">
                  <SourceBadge entry={entry} />
                  <span className="text-[10px] text-zinc-400">{formatEntryDate(entry.created_at)}</span>
                </div>
                <p className="text-sm font-medium text-zinc-800">{entry.title}</p>
                {entry.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{entry.description}</p>
                )}
                {entry.metadata?.next_action && (
                  <div className="mt-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-100">
                    <span className="text-[10px] font-semibold text-amber-700">Next: </span>
                    <span className="text-[10px] text-amber-800">{entry.metadata.next_action}</span>
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 mt-0.5">by {entry.actor_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {onLogCommunication && (
        <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
          <button
            onClick={onLogCommunication}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Log Communication
          </button>
        </div>
      )}
    </aside>
  );
}
