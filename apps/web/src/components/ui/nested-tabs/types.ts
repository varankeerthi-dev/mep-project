import type { ComponentType, ReactNode } from 'react';

export type TabBadgeVariant = 'primary' | 'urgent' | 'warning' | 'neutral' | 'success';

export interface SubTabItem {
  id: string;
  label: string;
  count?: number;
  badgeVariant?: TabBadgeVariant;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }>;
  meta?: ReactNode;
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badgeVariant?: TabBadgeVariant;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }>;
  subTabs?: SubTabItem[];
  meta?: ReactNode;
}

export interface FolderTabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  ariaLabel?: string;
}

export interface LineTabsProps {
  subTabs: SubTabItem[];
  activeSubTabId: string;
  onSubTabChange: (subTabId: string) => void;
  className?: string;
  ariaLabel?: string;
}

export interface NestedTabNavigationProps {
  tabs: TabItem[];
  activeTabId?: string;
  activeSubTabId?: string;
  onTabChange?: (tabId: string) => void;
  onSubTabChange?: (subTabId: string, parentTabId: string) => void;
  className?: string;
  folderClassName?: string;
  lineClassName?: string;
  ariaLabel?: string;
}
