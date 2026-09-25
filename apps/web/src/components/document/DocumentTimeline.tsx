export interface TimelineEvent {
  key: string;
  color: string;
  title: string;
  by?: string;
  desc?: string;
  time: string;
}

interface DocumentTimelineProps {
  events: TimelineEvent[];
  emptyTitle?: string;
  emptyHint?: string;
}

// DocumentTimeline - shared vertical rail used by quotation History and the
// sales order Activity trail (and future invoice / challan timelines).
// Callers pre-format `time`; colors/labels stay module-specific.
export function DocumentTimeline({ events, emptyTitle, emptyHint }: DocumentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-sm font-medium text-zinc-500">{emptyTitle || 'No history yet'}</div>
        {emptyHint ? (
          <div className="mt-1 text-[13px] text-zinc-400">{emptyHint}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute top-2 bottom-2 w-px bg-[#E5E7EB]" style={{ left: 5 }} />
      <div className="space-y-4">
        {events.map((ev) => (
          <div key={ev.key} className="relative">
            <span className="absolute rounded-full bg-white" style={{ width: 11, height: 11, left: -24, top: 5, border: `3px solid ${ev.color}` }} />
            <div className="bg-white border border-[#EEF0F3] rounded-lg px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-zinc-900">{ev.title}</span>
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">{ev.time}</span>
              </div>
              {ev.by ? <div className="mt-0.5 text-xs text-zinc-500">by {ev.by}</div> : null}
              {ev.desc ? <div className="mt-0.5 text-xs text-zinc-500">{ev.desc}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
