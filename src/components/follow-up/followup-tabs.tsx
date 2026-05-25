import { cn } from '@/lib/utils';
import type { FollowUpTab } from '@/types/followup';

const TABS: { id: FollowUpTab; label: string; description: string }[] = [
  { id: 'queue', label: 'Priority Queue', description: "Today's ranked follow-ups — all types" },
  { id: 'quotation', label: 'Quotation Follow-Up', description: 'Outstanding quotes → work orders' },
  { id: 'podc', label: 'PO/DC Backlog', description: 'Delivered work, PO pending' },
  { id: 'invoice', label: 'Invoice Follow-Up', description: 'Overdue escalation matrix' },
  { id: 'activity', label: 'Activity Logs', description: 'Unified follow-up trail' },
];

type FollowupTabsProps = {
  activeTab: FollowUpTab;
  onTabChange: (tab: FollowUpTab) => void;
  counts?: Partial<Record<FollowUpTab, number>>;
};

export function FollowupTabs({ activeTab, onTabChange, counts }: FollowupTabsProps) {
  return (
    <div className="shrink-0 border-b border-zinc-200 bg-white shadow-sm">
      <nav
        className="flex gap-4 overflow-x-auto px-2"
        aria-label="Follow-up sections"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 border-b-2 px-4 text-xs font-semibold transition-all duration-150',
                active
                  ? 'border-primary bg-transparent text-primary'
                  : 'border-transparent bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              )}
            >
              <span className="flex items-center gap-2 py-3">
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-zinc-100 text-zinc-600'
                    )}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
