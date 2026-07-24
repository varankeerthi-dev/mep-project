import React from 'react';
import { useLocation } from 'react-router-dom';
import { SubTabsNav, type SubTabItem } from '../../../../components/ui/SubTabsNav';

export const SUBCONTRACTOR_V2_MODULE_TABS: SubTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/subcontractors-v2' },
  { id: 'workorders', label: 'Work Orders', path: '/subcontractors-v2/workorders' },
  { id: 'attendance', label: 'Attendance', path: '/subcontractors-v2/attendance' },
  { id: 'payments', label: 'Payments', path: '/subcontractors-v2/payments' },
  { id: 'invoices', label: 'Invoices', path: '/subcontractors-v2/invoices' },
  { id: 'documents', label: 'Documents', path: '/subcontractors-v2/documents' },
];

export interface SubcontractorModuleNavProps {
  onNavigate: (path: string) => void;
  className?: string;
}

export const SubcontractorModuleNav: React.FC<SubcontractorModuleNavProps> = ({
  onNavigate,
  className,
}) => {
  const location = useLocation();
  const pathname = location.pathname;

  const activeTab = [...SUBCONTRACTOR_V2_MODULE_TABS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((t) => pathname === t.path || pathname.startsWith(t.path + '/'));

  return (
    <SubTabsNav
      tabs={SUBCONTRACTOR_V2_MODULE_TABS}
      activeTabId={activeTab?.id}
      onTabChange={(tab) => onNavigate(tab.path)}
      className={className}
    />
  );
};

export default SubcontractorModuleNav;
