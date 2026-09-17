import { useState, useCallback, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import type { NestedTabNavigationProps } from './types';
import { FolderTabs } from './folder-tabs';
import { LineTabs } from './line-tabs';

/**
 * NestedTabNavigation
 *
 * Full two-tier tab navigation suite:
 * - Tier 1: Folder Tabs (main sub-tabs with connected borders and bottom mask)
 * - Tier 2: Line Tabs (nested sub-tabs with active blue hugging line)
 *
 * Reusable across any module in the ERP.
 */
export const NestedTabNavigation = memo(function NestedTabNavigation({
  tabs,
  activeTabId: controlledTabId,
  activeSubTabId: controlledSubTabId,
  onTabChange,
  onSubTabChange,
  className,
  folderClassName,
  lineClassName,
  ariaLabel = 'Module tab navigation',
}: NestedTabNavigationProps) {
  const [internalTabId, setInternalTabId] = useState<string>(tabs[0]?.id || '');
  const activeTabId = controlledTabId !== undefined ? controlledTabId : internalTabId;

  const currentTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const [internalSubTabMap, setInternalSubTabMap] = useState<Record<string, string>>({});
  const activeSubTabId =
    controlledSubTabId !== undefined
      ? controlledSubTabId
      : internalSubTabMap[activeTabId] || currentTab?.subTabs?.[0]?.id || '';

  const handleTabClick = useCallback(
    (tabId: string) => {
      setInternalTabId(tabId);
      onTabChange?.(tabId);

      const targetTab = tabs.find((t) => t.id === tabId);
      if (targetTab?.subTabs && targetTab.subTabs.length > 0) {
        const nextSubTabId = internalSubTabMap[tabId] || targetTab.subTabs[0].id;
        setInternalSubTabMap((prev) => ({ ...prev, [tabId]: nextSubTabId }));
        onSubTabChange?.(nextSubTabId, tabId);
      }
    },
    [tabs, internalSubTabMap, onTabChange, onSubTabChange]
  );

  const handleSubTabClick = useCallback(
    (subTabId: string) => {
      setInternalSubTabMap((prev) => ({ ...prev, [activeTabId]: subTabId }));
      onSubTabChange?.(subTabId, activeTabId);
    },
    [activeTabId, onSubTabChange]
  );

  return (
    <div className={cn('w-full flex flex-col font-sans shrink-0', className)}>
      {/* Tier 1: Connected Folder Tabs */}
      <FolderTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={handleTabClick}
        className={folderClassName}
        ariaLabel={`${ariaLabel} primary`}
      />

      {/* Tier 2: Nested Sub-Line Tabs (rendered only when current tab has subTabs) */}
      {currentTab?.subTabs && currentTab.subTabs.length > 0 && (
        <LineTabs
          subTabs={currentTab.subTabs}
          activeSubTabId={activeSubTabId}
          onSubTabChange={handleSubTabClick}
          className={lineClassName}
          ariaLabel={`${currentTab.label} sub-tabs`}
        />
      )}
    </div>
  );
});
