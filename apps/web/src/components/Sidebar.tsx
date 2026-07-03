import { useState, useCallback, useMemo } from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import { useOrgModules } from '../hooks/useOrgModules';

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
  flyout?: boolean;
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

// Maps sidebar menu IDs to module-registry IDs
const SIDEBAR_MODULE_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  'projects-overview': 'projects',
  projects: 'projects',
  tools: 'tools_management',
  approvals: 'approvals',
  todo: 'daily_updates',
  'follow-up': 'follow_up',
  'payments-hub': 'ledger',
  'advances-expenses': 'advances_expenses',
  clients: 'clients',
  'site-visit': 'site_visits',
  'site-report': 'site_reports',
  'client-communication': 'site_reports',
  subcontractor: 'subcontractors',
  leads: 'leads',
  quotation: 'quotations',
  invoice: 'invoices',
  'proforma-invoices': 'proforma_invoices',
  'credit-notes': 'credit_notes',
  ledger: 'ledger',
  boq: 'boq',
  issue: 'site_reports',
  procurement: 'materials',
  store: 'materials',
  purchase: 'purchase',
  dc: 'delivery_challans',
  'client-po': 'client_purchase_orders',
  'non-billable-dc': 'delivery_challans',
  reports: 'reports',
};

const menuData: MenuSection[] = [
  {
    section: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'projects-overview', label: 'CEO Dashboard', path: '/projects-overview' }
    ]
  },
  {
    section: 'Work',
    items: [
      { id: 'projects', label: 'Projects', path: '/projects' },
      { id: 'approvals', label: 'Approvals', path: '/approvals' },
      { id: 'todo', label: 'To do', path: '/todo' },
      { id: 'follow-up', label: 'Follow-up', path: '/follow-up' },
      { id: 'client-communication', label: 'Communication log', path: '/client-communication' }
    ]
  },
  {
    section: 'Client and field',
    items: [
      {
        id: 'clients',
        label: 'Clients',
        submenu: [
          { id: 'clients-list', label: 'Client list', path: '/clients' },
          { id: 'client-po-list', label: 'Purchase orders', path: '/client-po' },
          { id: 'client-meetings', label: 'Meetings', path: '/meetings' }
        ]
      },
      { id: 'site-visit', label: 'Site visit', path: '/site-visits' },
      {
        id: 'site-report',
        label: 'Site report',
        submenu: [
          { id: 'site-report-dashboard', label: 'Reports', path: '/site-reports' },
          { id: 'site-report-handover', label: 'Handover planner', path: '/handover' }
        ]
      },
      {
        id: 'issue',
        label: 'Issues',
        submenu: [
          { id: 'issue-dashboard', label: 'Dashboard', path: '/issue' },
          { id: 'issue-list', label: 'All issues', path: '/issues' }
        ]
      },
      {
        id: 'subcontractor',
        label: 'Sub-contractor',
        flyout: true,
        submenu: [
          { id: 'subcontractor-dashboard', label: 'Dashboard', path: '/subcontractors' },
          { id: 'subcontractor-create', label: 'Add new', path: '/subcontractors/new' },
          { id: 'subcontractor-workorders', label: 'Work orders', path: '/subcontractors/workorders' },
          { id: 'subcontractor-attendance', label: 'Attendance', path: '/subcontractors/attendance' },
          { id: 'subcontractor-payments', label: 'Payments', path: '/subcontractors/payments' },
          { id: 'subcontractor-invoices', label: 'Invoices', path: '/subcontractors/invoices' },
          { id: 'subcontractor-payment-queue', label: 'Payment queue', path: '/subcontractors/payments' },
          { id: 'subcontractor-documents', label: 'Documents', path: '/subcontractors/documents' }
        ]
      }
    ]
  },
  {
    section: 'Commerce',
    items: [
      {
        id: 'leads',
        label: 'Leads',
        submenu: [
          { id: 'leads-list', label: 'List view', path: '/leads' },
          { id: 'leads-kanban', label: 'Kanban', path: '/leads/kanban' }
        ]
      },
      {
        id: 'quotation',
        label: 'Quotation',
        submenu: [
          { id: 'quotation-list', label: 'Quotation list', path: '/quotation' },
          { id: 'quotation-create', label: 'Create quotation', path: '/quotation/create' },
          { id: 'boq-list', label: 'BOQ list', path: '/boq' },
          { id: 'boq-create', label: 'Create BOQ', path: '/boq/create' }
        ]
      },
      {
        id: 'sales-orders',
        label: 'Sales Orders',
        submenu: [
          { id: 'sales-orders-list', label: 'Sales Orders list', path: '/sales-orders' },
          { id: 'sales-orders-create', label: 'Create Sales Order', path: '/sales-orders/create' }
        ]
      },
      {
        id: 'invoice',
        label: 'Invoices',
        submenu: [
          { id: 'invoice-list', label: 'Invoice list', path: '/invoices' },
          { id: 'invoice-create', label: 'Create invoice', path: '/invoices/create' },
          { id: 'proforma-list', label: 'Proforma invoice', path: '/proforma-invoices' },
          { id: 'credit-note-list', label: 'Credit notes', path: '/credit-notes' }
        ]
      },
      { id: 'ledger', label: 'Ledger', path: '/ledger' },
      {
        id: 'dc',
        label: 'Delivery challan',
        submenu: [
          { id: 'dc-list', label: 'DC list', path: '/dc/list' },
          { id: 'dc-create', label: 'Create DC', path: '/dc/create' },
          { id: 'nb-dc-list', label: 'NB-DC list', path: '/nb-dc/list' },
          { id: 'dc-consolidation', label: 'Consolidation', path: '/dc/consolidation' }
        ]
      }
    ]
  },
  {
    section: 'Supply chain',
    items: [
      { id: 'procurement', label: 'Procurement', path: '/procurement' },
      {
        id: 'store',
        label: 'Materials',
        flyout: true,
        submenu: [
          { id: 'materials-list', label: 'Items/materials', path: '/store/materials' },
          { id: 'material-inward', label: 'Material inward', path: '/store/inward' },
          { id: 'material-outward', label: 'Material outward', path: '/store/outward' },
          { id: 'stock-transfer', label: 'Stock transfer', path: '/store/transfer' },
          { id: 'stock-balance', label: 'Stock balance', path: '/store/stock' },
          { id: 'quick-stock-check', label: 'Stock check', path: '/quick-stock-check' },
          { id: 'warehouses', label: 'Warehouses', path: '/store/materials?tab=warehouses' }
        ]
      },
      {
        id: 'manufacturing',
        label: 'Manufacturing',
        flyout: true,
        submenu: [
          { id: 'mfg-dashboard', label: 'Dashboard', path: '/manufacturing' },
          { id: 'mfg-inventory', label: 'Inventory', path: '/manufacturing/inventory' },
          { id: 'mfg-boms', label: 'BOMs', path: '/manufacturing/boms' },
          { id: 'mfg-schedules', label: 'Production schedules', path: '/manufacturing/schedules' },
          { id: 'mfg-job-cards', label: 'Job cards', path: '/manufacturing/job-cards' },
          { id: 'mfg-production', label: 'Production entry', path: '/manufacturing/production' },
          { id: 'mfg-custom-units', label: 'Custom units', path: '/manufacturing/custom-units' },
          { id: 'mfg-activity-log', label: 'Activity log', path: '/manufacturing/activity-log' }
        ]
      },
      {
        id: 'purchase',
        label: 'Purchase',
        flyout: true,
        submenu: [
          { id: 'purchase-vendors', label: 'Vendors', path: '/purchase/vendors' },
          { id: 'purchase-requisitions', label: 'Requisitions', path: '/purchase/requisitions' },
          { id: 'purchase-inquiries', label: 'Availability inquiry', path: '/purchase/inquiries' },
          { id: 'purchase-orders', label: 'Purchase orders', path: '/purchase/orders' },
          { id: 'purchase-bills', label: 'Bills', path: '/purchase/bills' },
          { id: 'purchase-invoice-verification', label: 'Invoice verification', path: '/purchase/invoice-verification' },
          { id: 'purchase-debit-notes', label: 'Debit notes', path: '/purchase/debit-notes' },
          { id: 'purchase-payments', label: 'Payments', path: '/purchase/payments' },
          { id: 'purchase-payment-queue', label: 'Bills due', path: '/purchase/payment-queue' }
        ]
      }
    ]
  },
  {
    section: 'Finance',
    items: [
      { id: 'payments-hub', label: 'Payments hub', path: '/finance/payments' },
      { id: 'advances-expenses', label: 'Advances & Expenses', path: '/advances-expenses' },
      { id: 'chart-of-accounts', label: 'Chart of accounts', path: '/accounting/chart-of-accounts' },
      { id: 'day-book', label: 'Day book', path: '/accounting/day-book' }
    ]
  },
  {
    section: 'Reports',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        submenu: [
          { id: 'reports-dashboard', label: 'Dashboard', path: '/reports' },
          { id: 'invoice-reports', label: 'Invoices', path: '/reports/invoices' },
          { id: 'financial-reports', label: 'Financial', path: '/reports/financial' },
          { id: 'project-reports', label: 'Projects', path: '/reports/projects' },
          { id: 'inventory-reports', label: 'Inventory', path: '/reports/inventory' },
          { id: 'compliance-reports', label: 'Compliance', path: '/reports/compliance' },
          { id: 'stock-report', label: 'Stock', path: '/reports/stock' },
          { id: 'purchase-report', label: 'Purchase', path: '/reports/purchase' },
          { id: 'sales-report', label: 'Sales', path: '/reports/sales' },
          { id: 'profit-report', label: 'Profit', path: '/reports/profit' }
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
        flyout: true,
        submenu: [
          { id: 'settings-general', label: 'General', path: '/settings' },
          { id: 'settings-approval', label: 'Approval settings', path: '/approval-settings' },
          { id: 'documents', label: 'Documents', path: '/documents' },
          { id: 'settings-print', label: 'Print settings', path: '/settings/print' },
          { id: 'settings-document', label: 'Document series', path: '/settings/document-series' },
          { id: 'settings-template', label: 'Template settings', path: '/settings/template' },
          { id: 'settings-terms', label: 'Terms and conditions', path: '/settings/terms-conditions' },
          { id: 'settings-organisation', label: 'Organisation', path: '/settings/organisation' },
          { id: 'settings-access', label: 'Access control', path: '/settings/access-control' },
          { id: 'settings-discounts', label: 'Discount settings', path: '/settings/discounts' },
          { id: 'settings-tools', label: 'Tools settings', path: '/tools-settings' }
        ]
      }
    ]
  }
];

const ICON_MAP: Record<string, keyof typeof HeroIcons> = {
  dashboard: 'HomeIcon',
  'projects-overview': 'SignalIcon',
  projects: 'FolderIcon',
  todo: 'ClipboardDocumentCheckIcon',
  tasks: 'ListBulletIcon',
  approvals: 'CheckCircleIcon',
  clients: 'UsersIcon',
  'client-po': 'DocumentTextIcon',
  meetings: 'CalendarDaysIcon',
  'site-visit': 'MapPinIcon',
  tools: 'WrenchIcon',
  'site-report': 'ClipboardDocumentCheckIcon',
  'client-communication': 'ChatBubbleLeftRightIcon',
  subcontractor: 'UserGroupIcon',
  'client-requests': 'InboxIcon',
  leads: 'UserPlusIcon',
  quotation: 'DocumentDuplicateIcon',
  'sales-orders': 'ClipboardDocumentCheckIcon',
  invoice: 'DocumentTextIcon',
  'credit-notes': 'ArrowUturnLeftIcon',
  'proforma-invoices': 'DocumentTextIcon',
  ledger: 'DocumentTextIcon',
  'follow-up': 'BellAlertIcon',
  boq: 'TableCellsIcon',
  documents: 'FolderOpenIcon',
  issue: 'ExclamationTriangleIcon',
  store: 'CubeIcon',
  purchase: 'ShoppingCartIcon',
  'purchase-vendors': 'BuildingOffice2Icon',
  'purchase-requisitions': 'ClipboardDocumentListIcon',
  'purchase-inquiries': 'MagnifyingGlassIcon',
  'purchase-orders': 'DocumentTextIcon',
  'purchase-bills': 'ReceiptRefundIcon',
  'purchase-invoice-verification': 'ShieldCheckIcon',
  'purchase-debit-notes': 'PencilSquareIcon',
  'purchase-payments': 'BanknotesIcon',
  'payments-hub': 'WalletIcon',
  'advances-expenses': 'BanknotesIcon',
  'purchase-payment-queue': 'ClockIcon',
  procurement: 'ClipboardDocumentListIcon',
  manufacturing: 'Cog6ToothIcon',
  accounting: 'CalculatorIcon',
  'chart-of-accounts': 'RectangleGroupIcon',
  'day-book': 'BookOpenIcon',
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
  const { data: modules } = useOrgModules();

  const enabledModuleIds = useMemo(() => {
    if (!modules) return null;
    const set = new Set<string>();
    for (const m of modules) {
      if (m.enabled) set.add(m.moduleId);
    }
    return set;
  }, [modules]);

  const isModuleEnabled = useCallback((menuId: string): boolean => {
    if (!enabledModuleIds) return true;
    const moduleId = SIDEBAR_MODULE_MAP[menuId];
    if (!moduleId) return true;
    return enabledModuleIds.has(moduleId);
  }, [enabledModuleIds]);

  const filteredMenuData = useMemo(() => {
    return menuData.map(section => ({
      ...section,
      items: section.items.filter(item => isModuleEnabled(item.id))
    })).filter(section => section.items.length > 0);
  }, [isModuleEnabled]);

  // Extract Settings section
  const settingsSection = useMemo(() => {
    return filteredMenuData.find(s => s.section === 'Settings');
  }, [filteredMenuData]);

  // Extract non-Settings sections
  const otherSections = useMemo(() => {
    return filteredMenuData.filter(s => s.section !== 'Settings');
  }, [filteredMenuData]);

  // Compute which menus to expand on first render only
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
  }, []);

  const [expandedMenus, setExpandedMenus] = useState<string[]>(initialExpandedMenus);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [flyoutMenu, setFlyoutMenu] = useState<string | null>(null);

  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  }, []);

  const handleClick = useCallback((item: MenuItem) => () => {
    if (item.flyout) {
      setFlyoutMenu(prev => prev === item.id ? null : item.id);
      return;
    }
    setFlyoutMenu(null);
    if (item.submenu) {
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
    setFlyoutMenu(null);
    onNavigate(pathKey);
  }, [onNavigate, pathKey]);

  const isParentActive = useCallback((item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(sub => pathKey === sub.path);
    }
    return item.path && pathKey === item.path;
  }, [pathKey]);

  const isActive = useCallback((path: string) => pathKey === path, [pathKey]);

  const activeFlyoutItem = useMemo(() => {
    if (!flyoutMenu) return null;
    for (const section of filteredMenuData) {
      const found = section.items.find(item => item.id === flyoutMenu);
      if (found) return found;
    }
    return null;
  }, [flyoutMenu, filteredMenuData]);

  const { ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon } = HeroIcons;

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={handleOverlayClick} />}
      <div className="sidebar-layout">
        <aside
          data-tour-anchor="sidebar"
          className={cx(
            'sidebar',
            isCollapsed && 'collapsed',
            mobileOpen && 'mobile-open'
          )}
        >
          <div className="sidebar-content">
            {otherSections.map(section => {
              const isSectionExpanded = !collapsedSections.includes(section.section);
              return (
                <div key={section.section} className="sidebar-section">
                  {section.section && !isCollapsed && (
                    <div
                      className="sidebar-section-header"
                      onClick={() => {
                        setCollapsedSections(prev =>
                          prev.includes(section.section)
                            ? prev.filter(s => s !== section.section)
                            : [...prev, section.section]
                        );
                      }}
                    >
                      <span className="sidebar-section-title">{section.section}</span>
                      <span className={cx('sidebar-section-chevron', isSectionExpanded && 'expanded')}>
                        <ChevronRightIcon />
                      </span>
                    </div>
                  )}
                  {isSectionExpanded && section.items.map(item => {
                    const parentActive = isParentActive(item);
                    const isExpanded = expandedMenus.includes(item.id);
                    const Icon = getIconComponent(item.id);
                    const isActiveBtn = parentActive && !(item.submenu && isExpanded);
                    const isParentActiveBtn = !!(item.submenu && isExpanded);

                    return (
                      <div key={item.id}>
                        <button
                          className={cx(
                            'sidebar-item',
                            isActiveBtn && 'active',
                            isParentActiveBtn && 'parent-active',
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
                            <span className={item.flyout ? "sidebar-flyout-pip" : "sidebar-item-chevron"}>
                              {item.flyout ? <ChevronRightIcon /> : <ChevronDownIcon />}
                            </span>
                          )}
                        </button>

                        {item.submenu && isExpanded && !isCollapsed && !item.flyout && (
                          <div className="sidebar-submenu">
                            {item.submenu.map(subItem => (
                              <div key={subItem.id}>
                                <button
                                  className={cx(
                                    'sidebar-submenu-item',
                                    isActive(subItem.path) && 'active'
                                  )}
                                  onClick={() => {
                                    setFlyoutMenu(null);
                                    subItem.submenu ? toggleMenu(subItem.id) : onNavigate(subItem.path);
                                  }}
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
                                        onClick={() => {
                                          setFlyoutMenu(null);
                                          onNavigate(nestedItem.path);
                                        }}
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
              );
            })}
          </div>

          <div className="sidebar-bottom">
            {settingsSection && settingsSection.items.map(item => {
              const parentActive = isParentActive(item);
              const isExpanded = expandedMenus.includes(item.id);
              const Icon = getIconComponent(item.id);
              const isActiveBtn = parentActive && !(item.submenu && isExpanded);
              const isParentActiveBtn = !!(item.submenu && isExpanded);

              return (
                <div key={item.id} className="w-full">
                  <button
                    className={cx(
                      'sidebar-item',
                      isActiveBtn && 'active',
                      isParentActiveBtn && 'parent-active',
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
                      <span className={item.flyout ? "sidebar-flyout-pip" : "sidebar-item-chevron"}>
                        {item.flyout ? <ChevronRightIcon /> : <ChevronDownIcon />}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
            <button className="sidebar-toggle" onClick={() => { setFlyoutMenu(null); onToggle(); }} type="button">
              <span className="sidebar-item-icon">
                {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </span>
              <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </div>
        </aside>
        {flyoutMenu && activeFlyoutItem && (
          <div className="sidebar-flyout">
            <div className="sidebar-flyout-title">{activeFlyoutItem.label}</div>
            {activeFlyoutItem.submenu?.map(sub => (
              <button
                key={sub.id}
                className={cx('sidebar-flyout-item', isActive(sub.path) && 'active')}
                onClick={() => {
                  setFlyoutMenu(null);
                  onNavigate(sub.path);
                }}
                type="button"
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
