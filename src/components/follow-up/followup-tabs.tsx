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
    <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-2.5">
      <nav
        className="flex gap-2 overflow-x-auto"
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
                'group relative flex min-w-[200px] shrink-0 flex-col justify-center rounded-t-lg border border-b-2 px-4 py-6 text-left transition-all duration-150',
                active
                  ? 'border-indigo-200 border-b-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-transparent border-b-transparent bg-transparent text-zinc-600 hover:border-zinc-200 hover:border-b-indigo-300 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{tab.label}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                      active
                        ? 'bg-indigo-200 text-indigo-800'
                        : 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200'
                    )}
                  >
                    {count}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'mt-1 block text-[11px] font-normal',
                  active ? 'text-indigo-600' : 'text-zinc-500'
                )}
              >
                {tab.description}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
