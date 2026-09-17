import React, { useState } from 'react';

export interface SubTabItem {
  id: string;
  label: string;
  count?: number;
  badgeVariant?: 'primary' | 'urgent' | 'neutral' | 'warning';
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badgeVariant?: 'primary' | 'urgent' | 'neutral' | 'warning';
  subTabs?: SubTabItem[];
}

export interface EnterpriseTabNavigationProps {
  tabs: TabItem[];
  activeTabId?: string;
  activeSubTabId?: string;
  onTabChange?: (tabId: string) => void;
  onSubTabChange?: (subTabId: string, parentTabId: string) => void;
  className?: string;
}

const BADGE_STYLES: Record<'primary' | 'urgent' | 'neutral' | 'warning', string> = {
  primary: 'bg-blue-100 text-blue-700',
  urgent: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-800',
};

export const EnterpriseTabNavigation: React.FC<EnterpriseTabNavigationProps> = ({
  tabs,
  activeTabId,
  activeSubTabId,
  onTabChange,
  onSubTabChange,
  className = '',
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    activeTabId || tabs[0]?.id || ''
  );

  const currentTabId = activeTabId !== undefined ? activeTabId : internalActiveTab;
  const currentTab = tabs.find((t) => t.id === currentTabId);

  const [internalActiveSubTab, setInternalActiveSubTab] = useState<string>(
    activeSubTabId || currentTab?.subTabs?.[0]?.id || ''
  );

  const currentSubTabId =
    activeSubTabId !== undefined
      ? activeSubTabId
      : (currentTab?.subTabs?.some((s) => s.id === internalActiveSubTab)
          ? internalActiveSubTab
          : currentTab?.subTabs?.[0]?.id || '');

  const handleTabClick = (tabId: string) => {
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
    const selected = tabs.find((t) => t.id === tabId);
    if (selected?.subTabs?.[0]) {
      setInternalActiveSubTab(selected.subTabs[0].id);
      onSubTabChange?.(selected.subTabs[0].id, tabId);
    }
  };

  const handleSubTabClick = (subTabId: string) => {
    setInternalActiveSubTab(subTabId);
    onSubTabChange?.(subTabId, currentTabId);
  };

  return (
    <div className={`w-full bg-white font-sans ${className}`}>
      {/* Tier 1: Connected Folder Tabs */}
      <header className="border-b border-slate-300 bg-white px-6 pt-3 select-none">
        <nav
          className="flex overflow-x-auto no-scrollbar -mb-px items-end space-x-0.5"
          role="tablist"
          aria-label="Workspace tabs"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === currentTabId;
            const badgeStyle = tab.badgeVariant
              ? BADGE_STYLES[tab.badgeVariant]
              : isActive
              ? BADGE_STYLES.primary
              : BADGE_STYLES.neutral;

            if (isActive) {
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={true}
                  onClick={() => handleTabClick(tab.id)}
                  className="group relative z-10 inline-flex items-center gap-2 px-5 py-2.5 bg-white border-t border-l border-r border-b-0 border-slate-300 rounded-t-lg text-blue-600 font-semibold text-sm focus:outline-none -mb-px shadow-xs cursor-pointer select-none shrink-0"
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold leading-none rounded-full ${badgeStyle}`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {/* Bottom mask to seamlessly bridge into page body without any horizontal line */}
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
                role="tab"
                aria-selected={false}
                onClick={() => handleTabClick(tab.id)}
                className="group inline-flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors duration-150 focus:outline-none cursor-pointer select-none shrink-0"
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold leading-none rounded-full ${badgeStyle}`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Tier 2: Nested Sub-Line Tabs (Rendered when active tab has subTabs) */}
      {currentTab?.subTabs && currentTab.subTabs.length > 0 && (
        <LineTabs
          subTabs={currentTab.subTabs}
          activeSubTabId={currentSubTabId}
          onSubTabChange={handleSubTabClick}
          ariaLabel={`${currentTab.label} sub tabs`}
        />
      )}
    </div>
  );
};

export interface LineTabsProps {
  subTabs?: SubTabItem[];
  activeSubTabId?: string;
  onSubTabChange?: (subTabId: string) => void;
  className?: string;
  ariaLabel?: string;
}

export const LineTabs: React.FC<LineTabsProps> = ({
  subTabs,
  activeSubTabId,
  onSubTabChange,
  className = '',
  ariaLabel = 'Sub tabs',
}) => {
  if (!subTabs || subTabs.length === 0) return null;

  return (
    <div className={`border-b border-slate-200 bg-white px-6 select-none ${className}`}>
      <nav
        className="flex items-center gap-6 overflow-x-auto no-scrollbar -mb-px text-sm pl-5"
        role="tablist"
        aria-label={ariaLabel}
      >
        {subTabs.map((subTab) => {
          const isActive = subTab.id === activeSubTabId;
          const badgeStyle = subTab.badgeVariant
            ? BADGE_STYLES[subTab.badgeVariant]
            : isActive
            ? BADGE_STYLES.primary
            : BADGE_STYLES.neutral;

          return (
            <button
              key={subTab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSubTabChange?.(subTab.id)}
              className={`relative inline-flex items-center gap-2 pt-3 pb-2.5 px-0 text-sm transition-colors duration-150 focus:outline-none select-none cursor-pointer shrink-0 ${
                isActive
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <span>{subTab.label}</span>
              {typeof subTab.count === 'number' && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold leading-none rounded-full ${badgeStyle}`}
                >
                  {subTab.count}
                </span>
              )}
              {/* Hugging bottom underline indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-full"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default EnterpriseTabNavigation;

