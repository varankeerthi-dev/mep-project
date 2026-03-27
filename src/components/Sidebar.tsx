import { useState } from 'react';
import {
  HomeIcon,
  FolderIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  UsersIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  InboxIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  FolderOpenIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

type SubmenuItem = {
  id: string;
  label: string;
  path: string;
};

type MenuItem = {
  id: string;
  label: string;
  path?: string;
  submenu?: SubmenuItem[];
};

type MenuSection = {
  section: string;
  items: MenuItem[];
};

type SidebarProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
};

const menuData: MenuSection[] = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/' }
    ]
  },
  {
    section: 'Projects',
    items: [
      { 
        id: 'projects', 
        label: 'Project', 
        submenu: [
          { id: 'projects-new', label: 'New Project', path: '/projects/new' },
          { id: 'projects-list', label: 'Project List', path: '/projects' },
          { id: 'daily-updates', label: 'Daily Updates', path: '/projects/daily-updates' },
          { id: 'site-materials', label: 'Site Materials', path: '/projects/site-materials' }
        ]
      },
      { id: 'todo', label: 'To Do List', path: '/todo' },
      { id: 'approvals', label: 'Approvals', path: '/approvals' }
    ]
  },
  {
    section: 'Client',
    items: [
      { 
        id: 'clients', 
        label: 'Client', 
        submenu: [
          { id: 'clients-new', label: 'Create Client', path: '/clients/new' },
          { id: 'clients-list', label: 'Client List', path: '/clients' }
        ]
      },
      {
        id: 'client-po',
        label: 'Client Purchase Orders',
        submenu: [
          { id: 'client-po-list', label: 'PO List', path: '/client-po' },
          { id: 'client-po-create', label: 'Create PO', path: '/client-po/create' }
        ]
      },
      {
        id: 'meetings',
        label: 'Meetings',
        submenu: [
          { id: 'meetings-dashboard', label: 'Dashboard', path: '/meetings' },
          { id: 'meetings-create', label: 'Create Meeting', path: '/meetings/create' }
        ]
      },
      {
        id: 'site-visit',
        label: 'Site Visit',
        submenu: [
          { id: 'site-visit-dashboard', label: 'Dashboard', path: '/site-visits' },
          { id: 'site-visit-create', label: 'New Visit', path: '/site-visits/new' }
        ]
      },
      {
        id: 'subcontractor',
        label: 'Sub-Contractor',
        submenu: [
          { id: 'subcontractor-dashboard', label: 'Dashboard', path: '/subcontractors' },
          { id: 'subcontractor-create', label: 'Add New', path: '/subcontractors/new' },
          { id: 'subcontractor-workorders', label: 'Work Orders', path: '/subcontractors/workorders' },
          { id: 'subcontractor-attendance', label: 'Attendance', path: '/subcontractors/attendance' },
          { id: 'subcontractor-dailylogs', label: 'Daily Logs', path: '/subcontractors/dailylogs' },
          { id: 'subcontractor-payments', label: 'Payments', path: '/subcontractors/payments' },
          { id: 'subcontractor-invoices', label: 'Invoices', path: '/subcontractors/invoices' },
          { id: 'subcontractor-documents', label: 'Documents', path: '/subcontractors/documents' }
        ]
      },
      {
        id: 'client-requests',
        label: 'Client Request',
        path: '/client-requests'
      }
    ]
  },
  {
    section: 'Documents',
    items: [
      { 
        id: 'quotation', 
        label: 'Quotation', 
        submenu: [
          { id: 'quotation-list', label: 'Quotation List', path: '/quotation' },
          { id: 'quotation-create', label: 'Create Quotation', path: '/quotation/create' }
        ]
      },
      {
        id: 'boq',
        label: 'BOQ',
        submenu: [
          { id: 'boq-list', label: 'BOQ List', path: '/boq' },
          { id: 'boq-create', label: 'Create BOQ', path: '/boq/create' }
        ]
      },
      { id: 'documents', label: 'Documents', path: '/documents' },
      { id: 'issue', label: 'Issue', path: '/issue' },
      { id: 'client-comm', label: 'Client Communication', path: '/client-comm' }
    ]
  },
  {
    section: 'Material',
    items: [
      { 
        id: 'store', 
        label: 'Material', 
        submenu: [
          { id: 'materials-list', label: 'Items/Materials', path: '/store/materials' },
          { id: 'material-inward', label: 'Material Inward', path: '/store/inward' },
          { id: 'material-outward', label: 'Material Outward', path: '/store/outward' },
          { id: 'stock-transfer', label: 'Stock Transfer', path: '/store/transfer' },
          { id: 'stock-balance', label: 'Stock Balance', path: '/store/stock' },
          { id: 'quick-stock-check', label: 'Quick Stock Check', path: '/quick-stock-check' },
          { id: 'warehouses', label: 'Warehouses', path: '/store/materials?tab=warehouses' }
        ]
      }
    ]
  },
  {
    section: 'Tools',
    items: [
      { id: 'tools', label: 'Tools', path: '/tools' }
    ]
  },
  {
    section: 'Delivery Challan',
    items: [
      { 
        id: 'dc', 
        label: 'Delivery Challan', 
        submenu: [
          { id: 'dc-create', label: 'Create DC', path: '/dc/create' },
          { id: 'dc-list', label: 'DC List', path: '/dc/list' },
          { id: 'dc-date-wise', label: 'Date-wise Consolidation', path: '/dc/consolidation/date' },
          { id: 'dc-material-wise', label: 'Material-wise Consolidation', path: '/dc/consolidation/material' }
        ]
      },
      {
        id: 'non-billable-dc',
        label: 'Non-Billable DC',
        submenu: [
          { id: 'nb-dc-create', label: 'Create NB-DC', path: '/nb-dc/create' },
          { id: 'nb-dc-list', label: 'NB-DC List', path: '/nb-dc/list' }
        ]
      }
    ]
  },
  {
    section: 'Report',
    items: [
      { 
        id: 'reports', 
        label: 'Report', 
        submenu: [
          { id: 'stock-report', label: 'Stock Report', path: '/reports/stock' },
          { id: 'purchase-report', label: 'Purchase Report', path: '/reports/purchase' },
          { id: 'sales-report', label: 'Sales Report', path: '/reports/sales' }
        ]
      }
    ]
  },
  {
    section: 'Settings',
    items: [
      { 
        id: 'settings', 
        label: 'Settings', 
        submenu: [
          { id: 'settings-general', label: 'General', path: '/settings' },
          { id: 'settings-print', label: 'Print Settings', path: '/settings/print' },
          { id: 'settings-document', label: 'Document Settings', path: '/settings/document-series' },
          { id: 'settings-template', label: 'Template Settings', path: '/settings/template' },
          { id: 'settings-organisation', label: 'Organisation Settings', path: '/settings/organisation' },
          { id: 'settings-discounts', label: 'Discount Settings', path: '/settings/discounts' }
        ]
      }
    ]
  }
];

const iconMap = {
  dashboard: HomeIcon,
  projects: FolderIcon,
  todo: ClipboardDocumentCheckIcon,
  approvals: ShieldCheckIcon,
  clients: UsersIcon,
  'client-po': DocumentTextIcon,
  meetings: CalendarDaysIcon,
  'site-visit': MapPinIcon,
  subcontractor: UserGroupIcon,
  'client-requests': InboxIcon,
  quotation: DocumentDuplicateIcon,
  boq: TableCellsIcon,
  documents: FolderOpenIcon,
  issue: ExclamationTriangleIcon,
  'client-comm': ChatBubbleLeftRightIcon,
  store: CubeIcon,
  tools: WrenchScrewdriverIcon,
  dc: TruckIcon,
  'non-billable-dc': TruckIcon,
  reports: ChartBarIcon,
  settings: Cog6ToothIcon
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

function getIcon(id: string) {
  return iconMap[id as keyof typeof iconMap] || HomeIcon;
}

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle, mobileOpen }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const defaults: string[] = [];
    menuData.forEach(section => {
      section.items.forEach(item => {
        if (item.submenu) {
          const isActive = item.submenu.some(sub => currentPath === sub.path || currentPath.startsWith(sub.path));
          if (isActive) defaults.push(item.id);
        }
      });
    });
    return defaults;
  });

  const isParentActive = (item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(sub => currentPath === sub.path);
    }
    return item.path && currentPath === item.path;
  };

  const isActive = (path: string) => currentPath === path;

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleClick = (item: MenuItem) => {
    if (item.submenu) {
      toggleMenu(item.id);
    } else if (item.path) {
      onNavigate(item.path);
    }
  };

  const handleSubmenuClick = (path: string) => {
    onNavigate(path);
  };

  const isCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => onNavigate(currentPath)} />}
      <aside
        className={cx(
          'sidebar',
          isCollapsed && 'collapsed',
          mobileOpen && 'mobile-open'
        )}
      >
        <div className="sidebar-content">
          {menuData.map(section => (
            <div key={section.section} className="sidebar-section">
              {!isCollapsed && (
                <div className="sidebar-section-title">
                  {section.section}
                </div>
              )}
              {section.items.map(item => {
                const parentActive = isParentActive(item);
                const isExpanded = expandedMenus.includes(item.id);
                const Icon = getIcon(item.id);

                return (
                  <div key={item.id}>
                    <button
                      className={cx(
                        'sidebar-item',
                        parentActive && 'active',
                        isExpanded && 'expanded'
                      )}
                      onClick={() => handleClick(item)}
                      type="button"
                    >
                      <span className="sidebar-item-icon">
                        <Icon />
                      </span>
                      {!isCollapsed && <span className="sidebar-item-label">{item.label}</span>}
                      {item.submenu && !isCollapsed && (
                        <span className="sidebar-item-chevron">
                          <ChevronDownIcon />
                        </span>
                      )}
                    </button>

                    {item.submenu && isExpanded && !isCollapsed && (
                      <div className="sidebar-submenu">
                        {item.submenu.map(subItem => (
                          <button
                            key={subItem.id}
                            className={cx(
                              'sidebar-submenu-item',
                              isActive(subItem.path) && 'active'
                            )}
                            onClick={() => handleSubmenuClick(subItem.path)}
                            type="button"
                          >
                            <span className="sidebar-item-label">{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="sidebar-toggle" onClick={onToggle} type="button">
            <span className="sidebar-item-icon">
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </span>
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
