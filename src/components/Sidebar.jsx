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

const menuData = [
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

const cx = (...classes) => classes.filter(Boolean).join(' ');

function getIcon(id) {
  return iconMap[id] || HomeIcon;
}

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle, mobileOpen }) {
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const defaults = [];
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

  const isParentActive = (item) => {
    if (item.submenu) {
      return item.submenu.some(sub => currentPath === sub.path);
    }
    return item.path && currentPath === item.path;
  };

  const isActive = (path) => currentPath === path;

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleClick = (item) => {
    if (item.submenu) {
      toggleMenu(item.id);
    } else if (item.path) {
      onNavigate(item.path);
    }
  };

  const handleSubmenuClick = (path) => {
    onNavigate(path);
  };

  const isCollapsed = collapsed && !mobileOpen;

  const itemBase = 'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors';
  const itemInactive = 'text-slate-700 hover:bg-orange-50 hover:text-orange-700';
  const itemActive = 'bg-emerald-900 text-white shadow-sm';

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => onNavigate(currentPath)} />}
      <aside
        className={cx(
          'fixed left-0 top-[60px] z-[900] h-[calc(100vh-60px)] border-r border-slate-200 bg-white font-inter text-[14px] shadow-sm transition-all duration-200',
          isCollapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
            {menuData.map(section => (
              <div key={section.section} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.section}
                  </div>
                )}
                {section.items.map(item => {
                  const parentActive = isParentActive(item);
                  const isExpanded = expandedMenus.includes(item.id);
                  const Icon = getIcon(item.id);

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        className={cx(itemBase, parentActive ? itemActive : itemInactive)}
                        onClick={() => handleClick(item)}
                        type="button"
                      >
                        <Icon className={cx('h-5 w-5 flex-shrink-0', parentActive ? 'text-white' : 'text-slate-500 group-hover:text-orange-600')} />
                        {!isCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                        {item.submenu && !isCollapsed && (
                          <ChevronDownIcon className={cx('h-4 w-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                        )}
                      </button>

                      {item.submenu && isExpanded && !isCollapsed && (
                        <div className="ml-8 space-y-1">
                          {item.submenu.map(subItem => (
                            <button
                              key={subItem.id}
                              className={cx(
                                itemBase,
                                'px-3 py-1.5 text-[14px]',
                                isActive(subItem.path) ? itemActive : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                              )}
                              onClick={() => handleSubmenuClick(subItem.path)}
                              type="button"
                            >
                              <span className="flex-1 truncate text-left">{subItem.label}</span>
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

          <div className="border-t border-slate-200 p-2">
            <button
              className={cx(
                itemBase,
                'justify-center text-slate-600 hover:bg-orange-50 hover:text-orange-700'
              )}
              onClick={onToggle}
              type="button"
            >
              {isCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
              {!isCollapsed && <span className="ml-2">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
