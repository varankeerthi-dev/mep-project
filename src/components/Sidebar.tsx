import { useState, useCallback, useMemo } from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';

type SubmenuItem = {
  id: string;
  label: string;
  path: string;
  submenu?: SubmenuItem[];
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
    section: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/' }
    ]
  },
  {
    section: 'Projects',
    items: [
      { id: 'projects', label: 'Projects', path: '/projects' }
    ]
  },
  {
    section: 'Tasks',
    items: [
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
          { id: 'clients-new', label: 'New Client', path: '/clients/new' },
          { id: 'clients-list', label: 'Client List', path: '/clients' },
          { id: 'client-po-list', label: 'Purchase Orders', path: '/client-po' },
          { id: 'client-meetings', label: 'Meetings', path: '/meetings' }
        ]
      },
      
      {
        id: 'site-visit',
        label: 'Site Visit',
        submenu: [
          { id: 'site-visit-dashboard', label: 'Dashboard', path: '/site-visits' }
        ]
      },
      {
        id: 'site-report',
        label: 'Site Report',
        submenu: [
          { id: 'site-report-dashboard', label: 'Reports', path: '/site-reports' }
        ]
      },
      {
        id: 'client-communication',
        label: 'Client Communication',
        submenu: [
          { id: 'client-comm-dashboard', label: 'Dashboard', path: '/client-communication' }
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
      }
    ]
  },
  {
    section: 'Sales',
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
        id: 'invoice',
        label: 'Invoices',
        path: '/invoices',
        submenu: [
          { id: 'invoice-list', label: 'Invoice List', path: '/invoices' },
          { id: 'invoice-create', label: 'Create Invoice', path: '/invoices/create' }
        ]
      },
      {
        id: 'ledger',
        label: 'Ledger',
        path: '/ledger'
      },
      {
        id: 'boq',
        label: 'BOQ',
        submenu: [
          { id: 'boq-list', label: 'BOQ List', path: '/boq' },
          { id: 'boq-create', label: 'Create BOQ', path: '/boq/create' }
        ]
      },
      { id: 'issue', label: 'Issue', path: '/issue' }
    ]
  },
  {
    section: 'Inventory',
    items: [
      { id: 'procurement', label: 'Procurement', path: '/procurement' },
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
    section: 'Purchase',
    items: [
      { 
        id: 'purchase', 
        label: 'Purchase', 
        path: '/purchase'
      }
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
          { id: 'nb-dc-create', label: 'Create NB-DC', path: '/nb-dc/create' },
          { id: 'nb-dc-list', label: 'NB-DC List', path: '/nb-dc/list' },
          { id: 'dc-consolidation', label: 'DC Consolidation', path: '/dc/consolidation' }
        ]
      }
    ]
  },
  {
    section: 'Reports',
    items: [
      { 
        id: 'reports', 
        label: 'Reports', 
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
          { id: 'documents', label: 'Documents', path: '/documents' },
          { id: 'settings-print', label: 'Print Settings', path: '/settings/print' },
          { id: 'settings-document', label: 'Document Settings', path: '/settings/document-series' },
          { id: 'settings-template', label: 'Template Settings', path: '/settings/template' },
          { id: 'settings-quick-quote', label: 'Quick Quote', path: '/settings/quick-quote' },
          { id: 'settings-organisation', label: 'Organisation Settings', path: '/settings/organisation' },
          { id: 'settings-access', label: 'Access Control', path: '/settings/access-control' },
          { id: 'settings-discounts', label: 'Discount Settings', path: '/settings/discounts' }
        ]
      }
    ]
  }
];

const ICON_MAP: Record<string, keyof typeof HeroIcons> = {
  dashboard: 'HomeIcon',
  projects: 'FolderIcon',
  todo: 'ClipboardDocumentCheckIcon',
  approvals: 'ShieldCheckIcon',
  clients: 'UsersIcon',
  'client-po': 'DocumentTextIcon',
  meetings: 'CalendarDaysIcon',
  'site-visit': 'MapPinIcon',
  'site-report': 'ClipboardDocumentCheckIcon',
  'client-communication': 'ChatBubbleLeftRightIcon',
  subcontractor: 'UserGroupIcon',
  'client-requests': 'InboxIcon',
  quotation: 'DocumentDuplicateIcon',
  invoice: 'DocumentTextIcon',
  ledger: 'DocumentTextIcon',
  boq: 'TableCellsIcon',
  documents: 'FolderOpenIcon',
  issue: 'ExclamationTriangleIcon',
  store: 'CubeIcon',
  purchase: 'ShoppingCartIcon',
  procurement: 'ClipboardDocumentListIcon',
  dc: 'TruckIcon',
  'non-billable-dc': 'TruckIcon',
  reports: 'ChartBarIcon',
  settings: 'Cog6ToothIcon'
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

// Memoized icon getter
const getIconComponent = (id: string) => {
  const iconName = ICON_MAP[id] || 'HomeIcon';
  return HeroIcons[iconName as keyof typeof HeroIcons];
};

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle, mobileOpen }: SidebarProps) {
  const isCollapsed = collapsed && !mobileOpen;
  const pathKey = (currentPath || '').split('?')[0];

  // Compute which menus to expand on first render only
  // (useState ignores the initial value after mount, so recomputing on path change was wasted work)
  const initialExpandedMenus = useMemo(() => {
    const defaults: string[] = [];
    menuData.forEach(section => {
      section.items.forEach(item => {
        if (item.submenu) {
          const isActive = item.submenu.some(sub => pathKey === sub.path || pathKey.startsWith(sub.path));
          if (isActive) defaults.push(item.id);
        }
      });
    });
    return defaults;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — user controls expansion after that

  const [expandedMenus, setExpandedMenus] = useState<string[]>(initialExpandedMenus);

  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  }, []);

  const handleClick = useCallback((item: MenuItem) => () => {
    if (item.submenu) {
      // When the sidebar is collapsed, submenus aren't visible. Navigate to the parent path instead.
      if (isCollapsed) {
        const target = item.path || item.submenu?.[0]?.path;
        if (target) onNavigate(target);
        return;
      }
      toggleMenu(item.id);
    } else if (item.path) {
      onNavigate(item.path);
    }
  }, [isCollapsed, toggleMenu, onNavigate]);

  const handleOverlayClick = useCallback(() => {
    // Just close the overlay; don't re-navigate
    onNavigate(pathKey);
  }, [onNavigate, pathKey]);

  const isParentActive = useCallback((item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(sub => pathKey === sub.path);
    }
    return item.path && pathKey === item.path;
  }, [pathKey]);

  const isActive = useCallback((path: string) => pathKey === path, [pathKey]);

  const { ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon } = HeroIcons;

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={handleOverlayClick} />}
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
                const Icon = getIconComponent(item.id);

                return (
                  <div key={item.id}>
                    <button
                      className={cx(
                        'sidebar-item',
                        parentActive && 'active',
                        isExpanded && 'expanded'
                      )}
                      onClick={handleClick(item)}
                      type="button"
                    >
                      <span className="sidebar-item-icon">
                        <Icon />
                      </span>
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.submenu && !isCollapsed && (
                        <span className="sidebar-item-chevron">
                          <ChevronDownIcon />
                        </span>
                      )}
                    </button>

                    {item.submenu && isExpanded && !isCollapsed && (
                      <div className="sidebar-submenu">
                        {item.submenu.map(subItem => (
                          <div key={subItem.id}>
                            <button
                              className={cx(
                                'sidebar-submenu-item',
                                isActive(subItem.path) && 'active'
                              )}
                              onClick={() => subItem.submenu ? toggleMenu(subItem.id) : onNavigate(subItem.path)}
                              type="button"
                            >
                              <span className="sidebar-item-label">{subItem.label}</span>
                              {subItem.submenu && (
                                <span className="sidebar-item-chevron">
                                  {expandedMenus.includes(subItem.id) ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                </span>
                              )}
                            </button>
                            {subItem.submenu && expandedMenus.includes(subItem.id) && (
                              <div className="sidebar-submenu" style={{ paddingLeft: '16px' }}>
                                {subItem.submenu.map(nestedItem => (
                                  <button
                                    key={nestedItem.id}
                                    className={cx(
                                      'sidebar-submenu-item',
                                      isActive(nestedItem.path) && 'active'
                                    )}
                                    onClick={() => onNavigate(nestedItem.path)}
                                    type="button"
                                  >
                                    <span className="sidebar-item-label">{nestedItem.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
