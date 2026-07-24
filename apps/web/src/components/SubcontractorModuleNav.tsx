import React from 'react';
import { useLocation } from 'react-router-dom';
import { SubTabsNav, type SubTabItem } from './ui/SubTabsNav';

/**
 * Module-level navigation tabs for the Sub-Contractor module.
 * Follows the Sub-Tabs Navigation Bar Pattern (DESIGN.md).
 */
export const SUBCONTRACTOR_MODULE_TABS: SubTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/subcontractors' },
  { id: 'workorders', label: 'Work Orders', path: '/subcontractors/workorders' },
  { id: 'attendance', label: 'Attendance', path: '/subcontractors/attendance' },
  { id: 'payments', label: 'Payments', path: '/subcontractors/payments' },
  { id: 'invoices', label: 'Invoices', path: '/subcontractors/invoices' },
  { id: 'documents', label: 'Documents', path: '/subcontractors/documents' },
];

export interface SubcontractorModuleNavProps {
  onNavigate: (path: string) => void;
  className?: string;
}

/**
 * Renders the sub-contractor module sub-tab bar.
 * Active tab is resolved by longest-prefix match so that
 * '/subcontractors/workorders' does not fall back to the
 * '/subcontractors' dashboard tab.
 */
export const SubcontractorModuleNav: React.FC<SubcontractorModuleNavProps> = ({
  onNavigate,
  className,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  const activeTab = [...SUBCONTRACTOR_MODULE_TABS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((t) => pathname === t.path || pathname.startsWith(t.path + '/'));

  return (
    <SubTabsNav
      tabs={SUBCONTRACTOR_MODULE_TABS}
      activeTabId={activeTab?.id}
      onTabChange={(tab) => onNavigate(tab.path)}
      className={className}
    />
  );
};

export default SubcontractorModuleNav;
