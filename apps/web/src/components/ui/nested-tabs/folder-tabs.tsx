import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { FolderTabsProps, TabBadgeVariant } from './types';

const BADGE_STYLES: Record<TabBadgeVariant, string> = {
  primary: 'bg-blue-100 text-blue-700',
  urgent: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-800',
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-800',
};

/**
 * FolderTabs (Tier 1)
 *
 * Connected browser/folder-style tab row.
 * The active tab connects seamlessly to the tier below it using a bottom white mask,
 * eliminating hairline 1px visual border artifacts across all screen scaling factors.
 */
export const FolderTabs = memo(function FolderTabs({
  tabs,
  activeTabId,
  onTabChange,
  className,
  ariaLabel = 'Primary section tabs',
}: FolderTabsProps) {
  return (
    <header className={cn('border-b border-slate-300 bg-white px-6 pt-3 select-none', className)}>
      <nav
        className="flex overflow-x-auto no-scrollbar -mb-px items-end space-x-0.5"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const badgeVariant = tab.badgeVariant || (isActive ? 'primary' : 'neutral');
          const badgeClass = BADGE_STYLES[badgeVariant];
          const Icon = tab.icon;

          if (isActive) {
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={true}
                disabled={tab.disabled}
                onClick={() => !tab.disabled && onTabChange(tab.id)}
                className={cn(
                  'group relative z-10 inline-flex items-center gap-2 px-5 py-2.5 bg-white border-t border-l border-r border-b-0 border-slate-300 rounded-t-lg text-blue-600 font-semibold text-sm focus:outline-none -mb-px shadow-xs cursor-pointer select-none shrink-0',
                  tab.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                {Icon && (
                  <Icon
                    className="h-4 w-4 shrink-0 transition-colors text-blue-600"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold leading-none tabular-nums rounded-full transition-colors',
                      badgeClass
                    )}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
                {tab.meta}

                {/* Bottom seamless bridge mask */}
                <span
                  className="absolute -bottom-px left-0 right-0 h-[2px] bg-white pointer-events-none"
                  aria-hidden="true"
                />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={false}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              className={cn(
                'group inline-flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors duration-150 focus:outline-none cursor-pointer select-none shrink-0',
                tab.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              {Icon && (
                <Icon
                  className="h-4 w-4 shrink-0 transition-colors text-slate-400 group-hover:text-slate-600"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold leading-none tabular-nums rounded-full transition-colors',
                    badgeClass
                  )}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
              {tab.meta}
            </button>
          );
        })}
      </nav>
    </header>
  );
});
