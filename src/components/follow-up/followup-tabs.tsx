import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Receipt,
  Clock,
} from 'lucide-react';
import type { FollowUpTab } from '@/types/followup';

const TABS: {
  id: FollowUpTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'queue', label: 'Priority Queue', description: "Today's ranked follow-ups — all types", icon: LayoutDashboard },
  { id: 'quotation', label: 'Quotations', description: 'Outstanding quotes → work orders', icon: FileText },
  { id: 'podc', label: 'PO/DC Backlog', description: 'Delivered work, PO pending', icon: Truck },
  { id: 'invoice', label: 'Invoices', description: 'Overdue escalation matrix', icon: Receipt },
  { id: 'activity', label: 'Activity', description: 'Unified follow-up trail', icon: Clock },
];

type FollowupTabsProps = {
  activeTab: FollowUpTab;
  onTabChange: (tab: FollowUpTab) => void;
  counts?: Partial<Record<FollowUpTab, number>>;
  orientation?: 'horizontal' | 'vertical';
};

function TabButton({
  tab,
  active,
  count,
  onClick,
  orientation,
  index,
}: {
  tab: (typeof TABS)[0];
  active: boolean;
  count: number | undefined;
  onClick: () => void;
  orientation: 'horizontal' | 'vertical';
  index: number;
}) {
  const isVertical = orientation === 'vertical';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isVertical
          ? 'w-full justify-start px-3 py-2.5 text-sm font-medium rounded-r-lg border-r-2 border-transparent'
          : 'shrink-0 h-[50px] px-4 text-sm font-medium rounded-t-lg border-b-2 border-transparent mx-[12px]',
        active
          ? 'bg-primary/5 text-primary border-primary'
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
        'group'
      )}
      style={
        active
          ? { transform: isVertical ? 'translateX(2px)' : 'translateY(-1px)' }
          : undefined
      }
    >
      <tab.icon
        className={cn(
          'h-4.5 w-4.5 shrink-0 transition-transform duration-200',
          active ? 'text-primary' : 'text-zinc-400 group-hover:text-zinc-600',
          isVertical && 'mr-1'
        )}
        aria-hidden="true"
      />
      <span className={cn('truncate', isVertical && 'font-medium')}>
        {tab.label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums transition-all duration-200',
            active
              ? 'bg-primary/10 text-primary'
              : 'bg-zinc-100 text-zinc-600',
            isVertical ? 'ml-auto' : 'ml-1.5'
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      {active && isVertical && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-full"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function FollowupTabs({
  activeTab,
  onTabChange,
  counts,
  orientation = 'vertical',
}: FollowupTabsProps) {
  const isVertical = orientation === 'vertical';

  return (
    <nav
      className={cn(
        'bg-white border-zinc-200 shrink-0 transition-all duration-200',
        isVertical
          ? 'hidden lg:flex lg:flex-col lg:border-r lg:w-56 lg:h-full'
          : 'flex gap-5 overflow-x-auto px-2 border-b'
      )}
      aria-label="Follow-up sections"
      role="tablist"
    >
      {TABS.map((tab, index) => {
        const active = activeTab === tab.id;
        const count = counts?.[tab.id];

        return (
          <TabButton
            key={tab.id}
            tab={tab}
            active={active}
            count={count}
            orientation={orientation}
            index={index}
            onClick={() => onTabChange(tab.id)}
          />
        );
      })}
    </nav>
  );
}

export function FollowupTabsMobile({
  activeTab,
  onTabChange,
  counts,
  onClose,
}: {
  activeTab: FollowUpTab;
  onTabChange: (tab: FollowUpTab) => void;
  counts?: Partial<Record<FollowUpTab, number>>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed right-0 top-0 bottom-0 w-64 bg-white border-l border-zinc-200 shadow-xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Follow-Up</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
            aria-label="Close tabs"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          {TABS.map((tab, index) => {
            const active = activeTab === tab.id;
            const count = counts?.[tab.id];

            return (
              <TabButton
                key={tab.id}
                tab={tab}
                active={active}
                count={count}
                orientation="vertical"
                index={index}
                onClick={() => {
                  onTabChange(tab.id);
                  onClose();
                }}
              />
            );
          })}
        </div>
      </aside>
    </div>
  );
}