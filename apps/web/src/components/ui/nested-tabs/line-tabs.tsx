import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { LineTabsProps, TabBadgeVariant } from './types';

const BADGE_STYLES: Record<TabBadgeVariant, string> = {
  primary: 'bg-blue-100 text-blue-700',
  urgent: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-800',
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-800',
};

/**
 * LineTabs (Tier 2)
 *
 * Clean horizontal sub-tab row rendered within a main tab section.
 * Features an active blue underline hugging the label, subtle count badges,
 * and precision alignment.
 */
export const LineTabs = memo(function LineTabs({
  subTabs,
  activeSubTabId,
  onSubTabChange,
  className,
  ariaLabel = 'Nested sub tabs',
}: LineTabsProps) {
  if (!subTabs || subTabs.length === 0) return null;

  return (
    <div className={cn('border-b border-slate-200 bg-white px-6 select-none', className)}>
      <nav
        className="flex items-center gap-6 overflow-x-auto no-scrollbar -mb-px text-sm pl-5"
        role="tablist"
        aria-label={ariaLabel}
      >
        {subTabs.map((subTab) => {
          const isActive = subTab.id === activeSubTabId;
          const badgeVariant = subTab.badgeVariant || (isActive ? 'primary' : 'neutral');
          const badgeClass = BADGE_STYLES[badgeVariant];
          const Icon = subTab.icon;

          return (
            <button
              key={subTab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={subTab.disabled}
              onClick={() => !subTab.disabled && onSubTabChange(subTab.id)}
              className={cn(
                'relative inline-flex items-center gap-2 pt-3 pb-2.5 px-0 text-sm transition-colors duration-150 focus:outline-none shrink-0 cursor-pointer select-none',
                subTab.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                isActive
                  ? 'font-semibold text-blue-600'
                  : 'font-medium text-slate-500 hover:text-slate-800'
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-colors',
                    isActive ? 'text-blue-600' : 'text-slate-400'
                  )}
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{subTab.label}</span>
              {typeof subTab.count === 'number' && (
                <span
                  className={cn(
                    'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums transition-colors',
                    badgeClass
                  )}
                >
                  {subTab.count > 99 ? '99+' : subTab.count}
                </span>
              )}
              {subTab.meta}

              {/* Hugging bottom blue underline indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-600"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});
