import { useMemo } from 'react';
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
import {
  NestedTabNavigation,
  type TabItem,
  type SubTabItem,
  type TabBadgeVariant,
} from '@/components/ui/nested-tabs';

export const FOLLOWUP_TAB_DEFINITIONS: {
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

export interface FollowupTabsProps {
  activeTab: FollowUpTab;
  onTabChange: (tab: FollowUpTab) => void;
  counts?: Partial<Record<FollowUpTab, number>>;
  orientation?: 'horizontal' | 'vertical';
  activeSubTabId?: string;
  onSubTabChange?: (subTabId: string, parentTabId: string) => void;
  subTabs?: Partial<Record<FollowUpTab, SubTabItem[]>>;
  className?: string;
}

export function FollowupTabs({
  activeTab,
  onTabChange,
  counts,
  orientation = 'horizontal',
  activeSubTabId,
  onSubTabChange,
  subTabs,
  className,
}: FollowupTabsProps) {
  const isVertical = orientation === 'vertical';

  const tabItems: TabItem[] = useMemo(() => {
    return FOLLOWUP_TAB_DEFINITIONS.map((def) => {
      const count = counts?.[def.id];
      let badgeVariant: TabBadgeVariant = 'neutral';
      if (def.id === 'queue') {
        badgeVariant = 'primary';
      } else if (def.id === 'invoice' && count && count > 0) {
        badgeVariant = 'urgent';
      }

      return {
        id: def.id,
        label: def.label,
        count: count !== undefined && count > 0 ? count : undefined,
        badgeVariant,
        subTabs: subTabs?.[def.id],
      };
    });
  }, [counts, subTabs]);

  if (isVertical) {
    return (
      <nav
        className={cn(
          'hidden lg:flex lg:flex-col lg:border-r border-slate-200 lg:w-56 lg:h-full bg-white p-2 space-y-1 select-none',
          className
        )}
        role="tablist"
        aria-label="Follow-up vertical sections"
      >
        {FOLLOWUP_TAB_DEFINITIONS.map((def) => {
          const active = activeTab === def.id;
          const count = counts?.[def.id];
          const Icon = def.icon;

          return (
            <button
              key={def.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(def.id)}
              className={cn(
                'relative flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 text-left select-none cursor-pointer',
                active
                  ? 'bg-blue-50/80 text-blue-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-blue-600' : 'text-slate-400')}
                aria-hidden="true"
              />
              <span className="truncate">{def.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none',
                    active ? 'bg-blue-200/80 text-blue-800' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <NestedTabNavigation
      tabs={tabItems}
      activeTabId={activeTab}
      activeSubTabId={activeSubTabId}
      onTabChange={(tabId) => onTabChange(tabId as FollowUpTab)}
      onSubTabChange={onSubTabChange}
      className={className}
      ariaLabel="Follow-up navigation"
    />
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
      <aside className="fixed right-0 top-0 bottom-0 w-64 bg-white border-l border-slate-200 shadow-xl animate-in slide-in-from-right duration-200 z-10 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Follow-Up Sections</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close tabs"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5l-10 10" />
            </svg>
          </button>
        </div>
        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          {FOLLOWUP_TAB_DEFINITIONS.map((def) => {
            const active = activeTab === def.id;
            const count = counts?.[def.id];
            const Icon = def.icon;

            return (
              <button
                key={def.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  onTabChange(def.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors text-left select-none',
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Icon
                  className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-slate-400')}
                  aria-hidden="true"
                />
                <span className="truncate">{def.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none',
                      active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}