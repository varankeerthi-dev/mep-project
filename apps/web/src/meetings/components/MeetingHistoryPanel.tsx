import { memo } from 'react';
import { CalendarClock, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMeetingHistory } from '../hooks/useMeetings';

interface MeetingHistoryPanelProps {
  entityType: 'task' | 'milestone' | 'project';
  entityId?: string;
  compact?: boolean;
}

export const MeetingHistoryPanel = memo(function MeetingHistoryPanel({
  entityType,
  entityId,
  compact = false,
}: MeetingHistoryPanelProps) {
  const navigate = useNavigate();
  const { data: history = [], isLoading, error } = useMeetingHistory(entityType, entityId);

  if (!entityId) return null;

  return (
    <section className={compact ? 'mt-4 rounded-lg border border-zinc-200 bg-white p-3' : 'card p-5'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <CalendarClock size={16} className="text-indigo-600" />
            Meeting history
          </h3>
          <p className="mt-1 text-xs text-zinc-500">Finalized MOMs linked to this {entityType}.</p>
        </div>
        {history.length > 0 && <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{history.length}</span>}
      </div>

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={14} className="animate-spin" /> Loading history...</div>
      ) : error ? (
        <div className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">Meeting history is unavailable.</div>
      ) : history.length === 0 ? (
        <div className="mt-3 rounded border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500">
          No finalized meeting has been linked yet.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {history.slice(0, compact ? 3 : 10).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => navigate(`/meetings/${entry.meeting_id}/view`)}
              className="block w-full px-3 py-3 text-left hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <FileText size={12} />
                <span>{entry.meeting_date}</span>
                <span className="capitalize">{entry.meeting_type}</span>
                {entry.source_type && <span className="rounded bg-indigo-50 px-1.5 py-0.5 capitalize text-indigo-700">{entry.source_type.replace('_', ' ')}</span>}
              </div>
              <p className="mt-1 text-xs font-medium text-zinc-800">{entry.source_title || entry.client_name || 'Meeting record'}</p>
              {entry.snippet && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{entry.snippet}</p>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
});

export default MeetingHistoryPanel;
