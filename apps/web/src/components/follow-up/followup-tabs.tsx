import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Receipt,
  Clock,
  UserPlus,
  ShoppingBag,
} from 'lucide-react';
import type { FollowUpTab } from '@/types/followup';

const TABS: {
  id: FollowUpTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'queue', label: 'Priority Queue', description: "Today's ranked follow-ups — all types", icon: LayoutDashboard },
  { id: 'lead', label: 'Leads', description: 'Pre-quote pipeline', icon: UserPlus },
  { id: 'quotation', label: 'Quotations', description: 'Outstanding quotes → work orders', icon: FileText },
  { id: 'podc', label: 'PO/DC Backlog', description: 'Delivered work, PO pending', icon: Truck },
  { id: 'invoice', label: 'Invoices', description: 'Overdue escalation matrix', icon: Receipt },
  { id: 'procurement', label: 'Procurement', description: 'Vendor PO follow-up', icon: ShoppingBag },
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
        'relative inline-flex items-center gap-1.5 transition-colors duration-200 ease-out active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isVertical
          ? 'w-full justify-start px-3 py-2 text-xs font-medium rounded-r-lg border-r-2 border-transparent'
          : 'shrink-0 h-[32px] px-2 text-[11px] font-medium leading-none rounded-t-sm border-b-2 border-transparent mx-0.5',
        active
          ? 'bg-blue-50/70 text-blue-700 font-semibold border-blue-600'
          : 'text-slate-500 hover:text-slate-900 hover:border-slate-300',
        'group'
      )}
      style={
        undefined
      }
    >
      <tab.icon
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
          active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600',
          isVertical && 'mr-1'
        )}
        aria-hidden="true"
      />
      <span className={cn('truncate leading-none', isVertical && 'font-medium')}>
        {tab.label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[16px] h-4 rounded-full px-1 text-[9px] font-bold tabular-nums leading-none transition-colors duration-200',
            active
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600 border border-slate-200',
            isVertical ? 'ml-auto' : 'ml-1'
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      {active && isVertical && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600 rounded-l-full"
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
        'bg-white border-slate-200 shrink-0 transition-colors duration-200',
        isVertical
          ? 'hidden lg:flex lg:flex-col lg:border-r lg:w-56 lg:h-full'
          : 'flex gap-0 overflow-x-auto px-0 border-b'
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
      <aside className="fixed right-0 top-0 bottom-0 w-64 bg-white border-l border-slate-200 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Follow-Up</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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