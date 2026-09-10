import React, { useMemo } from 'react';
import { SettingsCategory, SettingsTabDefinition } from '../types';
import { Button } from '@/components/ui/button';

export interface SettingsSidebarProps {
  tabs: SettingsTabDefinition[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  searchQuery: string;
  dirtyTabIds?: Set<string>;
}

const CATEGORY_ORDER: SettingsCategory[] = [
  'Organisation',
  'Documents',
  'Commerce',
  'Advanced',
  'Master Data',
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  searchQuery,
  dirtyTabIds = new Set(),
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTabs = useMemo(() => {
    if (!normalizedQuery) return tabs;
    return tabs.filter((t) => {
      const labelMatch = t.label.toLowerCase().includes(normalizedQuery);
      const categoryMatch = t.category.toLowerCase().includes(normalizedQuery);
      const indexMatch = t.searchIndex.some((idx) =>
        idx.toLowerCase().includes(normalizedQuery)
      );
      return labelMatch || categoryMatch || indexMatch;
    });
  }, [tabs, normalizedQuery]);

  const groupedTabs = useMemo(() => {
    const groups: Record<SettingsCategory, SettingsTabDefinition[]> = {
      Organisation: [],
      Documents: [],
      Commerce: [],
      Advanced: [],
      'Master Data': [],
    };

    filteredTabs.forEach((tab) => {
      if (groups[tab.category]) {
        groups[tab.category].push(tab);
      }
    });

    return groups;
  }, [filteredTabs]);

  return (
    <aside
      className="bg-white border-r border-zinc-200/90 flex flex-col shrink-0 min-h-screen py-3 px-1.5 overflow-y-auto"
      style={{ width: '160px', borderColor: '#e5e5e5' }}
    >
      {CATEGORY_ORDER.map((cat, catIdx) => {
        const catTabs = groupedTabs[cat] || [];
        if (catTabs.length === 0) return null;

        return (
          <div key={cat} className={catIdx === 0 ? 'mb-3' : 'mt-3 mb-3'}>
            <h4
              className="px-2.5 mb-1 font-bold text-zinc-400 uppercase tracking-wider"
              style={{ fontSize: '10px', letterSpacing: '0.06em' }}
            >
              {cat}
            </h4>
            <div className="space-y-0.5">
              {catTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTabId;
                const isDirty = dirtyTabIds.has(tab.id);

                return (
                  <Button variant="ghost" size="default" key={tab.id} type="button" onClick={() => onSelectTab(tab.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-left leading-tight ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                    }`}
                    style={{ fontSize: '10px', lineHeight: 1.3, paddingTop: 6, paddingBottom: 6, height: 'auto' }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon
                        className={`w-3 h-3 shrink-0 ${
                          isActive ? 'text-[#185FA5]' : 'text-zinc-400'
                        }`}
                      />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {isDirty && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-500 shrink-0 ml-1.5"
                        title="Unsaved changes in this section"
                      />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredTabs.length === 0 && (
        <div className="px-6 py-12 text-center text-xs text-zinc-400">
          No matching settings found for "{searchQuery}"
        </div>
      )}
    </aside>
  );
};
