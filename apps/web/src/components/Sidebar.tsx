import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrgModules } from '../hooks/useOrgModules';
import { useHasPermission } from '../rbac';

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
  operations: 'dashboard',
  'projects-overview': 'projects',
  projects: 'projects',
  tools: 'tools_management',
  approvals: 'approvals',
  tasks: 'tasks',
  collaboration: 'collaboration',
  'follow-up': 'follow_up',
  'payments-hub': 'ledger',
  'advances-expenses': 'advances_expenses',
  clients: 'clients',
  'site-visit': 'site_visits',
  'site-report': 'site_reports',
  'site-expenses': 'site_expenses',
  'client-communication': 'site_reports',
  'manager-alerts': 'site_reports',
  subcontractor: 'subcontractors',
  leads: 'leads',
  quotation: 'quotations',
  invoice: 'invoices',
  'proforma-invoices': 'proforma_invoices',
  'credit-notes': 'credit_notes',
  ledger: 'ledger',
  billing: 'invoices',
  estimation: 'estimation',
  'partner-allocation': 'partner_allocation',
  boq: 'boq',
  issue: 'site_reports',
  procurement: 'materials',
  store: 'materials',
  warehouse: 'warehouse',
  manufacturing: 'manufacturing',
  purchase: 'purchase',
  dc: 'delivery_challans',
  'client-po': 'client_purchase_orders',
  'non-billable-dc': 'delivery_challans',
  reports: 'reports',
  hr: 'hr',
};

const menuData: MenuSection[] = [
  {
    section: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'dashboard-demo', label: 'Dashboard Demo', path: '/dashboard-demo' },
      { id: 'operations', label: 'Operations', path: '/operations' },
      { id: 'projects-overview', label: 'CEO Dashboard', path: '/projects-overview' },
      { id: 'client-lookup', label: 'Quick Lookup', path: '/client-lookup' }
    ]
  },
  {
    section: 'Projects',
    items: [
      { id: 'projects', label: 'Projects', path: '/projects' },
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
      { id: 'site-expenses', label: 'Site expenses', path: '/site-expenses' },
    ]
  },
  {
    section: 'Work',
    items: [
      { id: 'tasks', label: 'Tasks', path: '/tasks' },
      { id: 'collaboration', label: 'Collaboration', path: '/collaboration' },
      { id: 'approvals', label: 'Approvals', path: '/approvals' },
      { id: 'manager-alerts', label: 'Manager alerts', path: '/manager-alerts' }
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
          { id: 'client-meetings', label: 'Meetings', path: '/meetings' },
          { id: 'ledger', label: 'Ledger', path: '/ledger' }
        ]
      },
      {
        id: 'subcontractor',
        label: 'Sub-contractor',
        flyout: true,
        submenu: [
          { id: 'subcontractor-dashboard', label: 'Dashboard', path: '/subcontractors-v2' },
          { id: 'subcontractor-create', label: 'Add new', path: '/subcontractors-v2/new' },
          { id: 'subcontractor-workorders', label: 'Work orders', path: '/subcontractors-v2/workorders' },
          { id: 'subcontractor-attendance', label: 'Attendance', path: '/subcontractors-v2/attendance' },
          { id: 'subcontractor-payments', label: 'Payments', path: '/subcontractors-v2/payments' },
          { id: 'subcontractor-invoices', label: 'Invoices', path: '/subcontractors-v2/invoices' },
          { id: 'subcontractor-payment-queue', label: 'Payment queue', path: '/subcontractors-v2/payments' },
          { id: 'subcontractor-documents', label: 'Documents', path: '/subcontractors-v2/documents' }
        ]
      }
    ]
  },
  {
    section: 'CRM',
    items: [
      { id: 'follow-up', label: 'Follow-up', path: '/follow-up' },
      { id: 'client-communication', label: 'Communication log', path: '/client-communication' },
      {
        id: 'leads',
        label: 'Leads',
        submenu: [
          { id: 'leads-list', label: 'List view', path: '/leads' },
          { id: 'leads-kanban', label: 'Kanban', path: '/leads/kanban' }
        ]
      }
    ]
  },
  {
    section: 'Estimation',
    items: [
      {
        id: 'estimation',
        label: 'Estimation',
        submenu: [
          { id: 'est-boq-list', label: 'BOQ list', path: '/estimation/boq' },
          { id: 'est-boq-create', label: 'Create BOQ', path: '/estimation/boq/new' },
          { id: 'est-tender-list', label: 'Tenders', path: '/estimation/tenders' },
          { id: 'est-tender-create', label: 'Create Tender', path: '/estimation/tenders/new' },
          { id: 'est-resources', label: 'Resource catalog', path: '/estimation/resources' }
        ]
      }
    ]
  },
  {
    section: 'Sales',
    items: [
      {
        id: 'partner-allocation',
        label: 'Partner Allocation',
        submenu: [
          { id: 'pa-partners', label: 'Partners', path: '/partner-allocation/partners' },
          { id: 'pa-allocations', label: 'Allocations', path: '/partner-allocation/allocations' },
          { id: 'pa-inbox', label: 'Partner Inbox', path: '/partner-allocation/inbox' }
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
      {
        id: 'dc',
        label: 'Delivery challan',
        submenu: [
          { id: 'dc-list', label: 'DC list', path: '/dc/list' },
          { id: 'dc-create', label: 'Create DC', path: '/dc/create' },
          { id: 'nb-dc-list', label: 'NB-DC list', path: '/nb-dc/list' },
          { id: 'dc-returns', label: 'Material returns', path: '/returns' },
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
          { id: 'material-inward', label: 'Material inward', path: '/store/materials?tab=inward' },
          { id: 'material-outward', label: 'Material outward', path: '/store/materials?tab=outward' },
          { id: 'stock-transfer', label: 'Stock transfer', path: '/store/materials?tab=stock-transfer' },
          { id: 'stock-balance', label: 'Stock balance', path: '/store/materials?tab=stock-balance' },
          { id: 'quick-stock-check', label: 'Stock check', path: '/store/materials?tab=stock-check' },
          { id: 'warehouses', label: 'Warehouses (legacy)', path: '/store/materials?tab=warehouses' }
        ]
      },
      {
        id: 'warehouse',
        label: 'Warehouse',
        flyout: true,
        submenu: [
          { id: 'wh-dashboard', label: 'Dashboard', path: '/warehouse/dashboard' },
          { id: 'wh-designer', label: 'Designer', path: '/warehouse/designer' },
          { id: 'wh-viewer', label: 'Viewer', path: '/warehouse/viewer' },
          { id: 'wh-inventory', label: 'Inventory', path: '/warehouse/inventory' },
          { id: 'wh-operations', label: 'Operations', path: '/warehouse/operations' },
          { id: 'wh-reports', label: 'Reports', path: '/warehouse/reports' },
          { id: 'wh-warehouses', label: 'Warehouses', path: '/warehouse/warehouses' }
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
      },
      {
        id: 'tools',
        label: 'Tools & Equipment',
        flyout: true,
        submenu: [
          { id: 'tools-list', label: 'Tools Management', path: '/tools-management' },
          { id: 'tools-settings', label: 'Tools Settings', path: '/tools-settings' }
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
    section: 'GST',
    items: [
      {
        id: 'gst',
        label: 'GST',
        path: '/gst/dashboard',
        submenu: [
          { id: 'gst-dashboard', label: 'GST Dashboard', path: '/gst/dashboard' },
          { id: 'gst-reconciliation', label: 'GST Reconciliation', path: '/gst/reconciliation' },
          { id: 'gst-reports', label: 'GST Reports', path: '/gst/reports' },
          { id: 'gstr1', label: 'GSTR-1', path: '/gst/gstr1' },
          { id: 'gstr2b', label: 'GSTR-2B', path: '/gst/gstr2b' },
          { id: 'gstr3b', label: 'GSTR-3B', path: '/gst/gstr3b' },
          { id: 'itc', label: 'ITC Management', path: '/gst/itc' },
          { id: 'rcm', label: 'RCM', path: '/gst/rcm' }
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
    section: 'Human Resources',
    items: [
      {
        id: 'hr',
        label: 'HR & Attendance',
        submenu: [
          { id: 'hr-employees', label: 'Employees', path: '/hr/employees' },
          { id: 'hr-planning', label: 'Attendance Planning', path: '/hr/planning' },
          { id: 'hr-entry', label: 'Attendance Entry', path: '/hr/entry' },
          { id: 'hr-salary-slip', label: 'Salary Slip', path: '/hr/salary-slip' }
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
        path: '/settings',
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
          { id: 'settings-tools', label: 'Tools settings', path: '/tools-settings' },
          { id: 'settings-table-demo', label: 'Table Demo', path: '/table-demo' },
          { id: 'settings-dynamic-table-demo', label: 'Dynamic Table Demo', path: '/dynamic-table-demo' },
          { id: 'settings-custom-table-demo', label: 'Custom Table Demo', path: '/custom-table-demo' }
        ]
      }
    ]
  }
];

// Material Symbols icon mapping strictly corresponding to code.html
const ICON_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  'dashboard-demo': 'preview',
  operations: 'tune',
  'projects-overview': 'insights',
  'client-lookup': 'person_search',
  projects: 'apartment',
  'site-visit': 'pin_drop',
  'site-report': 'lab_profile',
  issue: 'warning',
  'site-expenses': 'payments',
  tasks: 'task_alt',
  approvals: 'rule',
  todo: 'checklist',
  'manager-alerts': 'notification_important',
  clients: 'groups',
  subcontractor: 'engineering',
  'follow-up': 'schedule_send',
  'client-communication': 'forum',
  leads: 'contact_mail',
  estimation: 'calculate',
  'partner-allocation': 'handshake',
  quotation: 'request_quote',
  'sales-orders': 'orders',
  invoice: 'receipt',
  dc: 'local_shipping',
  procurement: 'shopping_bag',
  store: 'category',
  warehouse: 'warehouse',
  manufacturing: 'precision_manufacturing',
  purchase: 'shopping_cart_checkout',
  tools: 'home_repair_service',
  'payments-hub': 'account_balance_wallet',
  'advances-expenses': 'receipt_long',
  'chart-of-accounts': 'account_tree',
  'day-book': 'menu_book',
  gst: 'gavel',
  reports: 'analytics',
  hr: 'badge',
  settings: 'settings',
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle, mobileOpen }: SidebarProps) {
  const isCollapsed = collapsed && !mobileOpen;
  const pathKey = (currentPath || '').split('?')[0];
  const { organisation } = useAuth();
  const { data: modules } = useOrgModules();

  const companyName = organisation?.name || 'Construct ERP';
  const companyLogo = (organisation as any)?.logo_url;

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

  const { data: hasLookupPermission = true } = useHasPermission('quick_lookup.read');

  const filteredMenuData = useMemo(() => {
    const out: typeof menuData = [];
    for (const section of menuData) {
      const items = section.items.filter(item => {
        if (item.id === 'client-lookup' && !hasLookupPermission) return false;
        return isModuleEnabled(item.id);
      });
      if (items.length > 0) out.push({ ...section, items });
    }
    return out;
  }, [isModuleEnabled, hasLookupPermission]);

  // Extract Settings section
  const settingsSection = useMemo(() => {
    return filteredMenuData.find(s => s.section === 'Settings');
  }, [filteredMenuData]);

  // Extract non-Settings sections
  const otherSections = useMemo(() => {
    return filteredMenuData.filter(s => s.section !== 'Settings');
  }, [filteredMenuData]);

  // Check if any sub-item is active
  const isPathActive = useCallback((path: string) => pathKey === path, [pathKey]);

  const isParentActive = useCallback((item: MenuItem) => {
    if (item.submenu) {
      return item.submenu.some(sub => pathKey === sub.path || (sub.submenu && sub.submenu.some(nested => pathKey === nested.path)));
    }
    return !!(item.path && pathKey === item.path);
  }, [pathKey]);

  // Compute which menus to expand on initial render
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
  const [flyoutMenu, setFlyoutMenu] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number }>({ top: 0 });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => {
    return !!settingsSection?.items.some(item => isParentActive(item));
  });

  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  }, []);

  const handleFlyoutEnter = useCallback((itemId: string, e: React.MouseEvent) => {
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const flyoutEstHeight = 360;
    let top = rect.top;
    if (top + flyoutEstHeight > window.innerHeight) {
      top = Math.max(10, window.innerHeight - flyoutEstHeight - 16);
    }
    setFlyoutPos({ top: Math.max(10, top) });
    setFlyoutMenu(itemId);
  }, []);

  const handleFlyoutLeave = useCallback(() => {
    flyoutTimeoutRef.current = setTimeout(() => {
      setFlyoutMenu(null);
    }, 180);
  }, []);

  const handleFlyoutPanelEnter = useCallback(() => {
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
  }, []);

  const handleFlyoutPanelLeave = useCallback(() => {
    setFlyoutMenu(null);
  }, []);

  const handleClick = useCallback((item: MenuItem) => () => {
    if (item.path) {
      setFlyoutMenu(null);
      onNavigate(item.path);
      return;
    }
    if (item.submenu) {
      if (item.flyout) {
        setFlyoutMenu(prev => prev === item.id ? null : item.id);
        return;
      }
      if (isCollapsed) {
        const target = item.submenu?.[0]?.path;
        if (target) onNavigate(target);
        return;
      }
      toggleMenu(item.id);
    }
  }, [isCollapsed, toggleMenu, onNavigate]);

  const activeFlyoutItem = useMemo(() => {
    if (!flyoutMenu) return null;
    for (const section of filteredMenuData) {
      const found = section.items.find(item => item.id === flyoutMenu);
      if (found) return found;
    }
    return null;
  }, [flyoutMenu, filteredMenuData]);

  // Click outside to close flyouts
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sidebar-flyout') && !target.closest('.flyout-trigger')) {
        setFlyoutMenu(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const isSettingsActive = useMemo(() => {
    return !!settingsSection?.items.some(item => isParentActive(item));
  }, [settingsSection, isParentActive]);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-overlay fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <div className="sidebar-layout font-sans">
        <aside
          data-tour-anchor="sidebar"
          id="main-sidebar"
          className={cx(
            'sidebar relative z-40 h-screen bg-white text-slate-700 flex flex-col shrink-0 border-r border-slate-200 select-none shadow-sm transition-all duration-300 font-sans',
            isCollapsed ? 'w-16 collapsed' : 'w-64',
            mobileOpen && 'mobile-open'
          )}
          style={{ width: isCollapsed ? 64 : 256 }}
        >
          {/* Top Branding Header with Dynamic Company Name / Logo */}
          <div
            className={cx(
              "h-14 px-3 flex items-center justify-between border-b border-slate-200 bg-slate-50/70 shrink-0 font-sans",
              isCollapsed && "justify-center px-0"
            )}
          >
            {!isCollapsed ? (
              <>
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden">
                    {companyLogo ? (
                      <img src={companyLogo} alt={companyName} className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">construction</span>
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-bold text-slate-900 tracking-wide uppercase truncate leading-none font-sans" title={companyName}>
                      {companyName}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-sans">
                      Workspace
                    </span>
                  </div>
                </div>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
                  id="toggle-collapse-btn"
                  onClick={onToggle}
                  title="Toggle Navigation"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">menu_open</span>
                </button>
              </>
            ) : (
              <button
                className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm hover:opacity-90 transition-opacity overflow-hidden"
                onClick={onToggle}
                title={companyName}
                type="button"
              >
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="w-full h-full object-contain p-0.5" />
                ) : (
                  <span className="material-symbols-outlined text-[20px]">construction</span>
                )}
              </button>
            )}
          </div>

          {/* Scrollable Navigation Tree */}
          <div className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2.5 space-y-3 overflow-x-hidden font-sans">
            {otherSections.map((section, idx) => {
              const isFirstSection = idx === 0;

              return (
                <div
                  key={section.section || 'root'}
                  className={cx(
                    !isFirstSection && "pt-1.5 border-t border-slate-200"
                  )}
                >
                  {/* Section Title */}
                  {section.section && !isCollapsed && (
                    <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                      {section.section}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {section.items.map(item => {
                      const iconName = ICON_MAP[item.id] || 'circle';
                      const parentActive = isParentActive(item);
                      const isExpanded = expandedMenus.includes(item.id);
                      const isFlyout = !!item.flyout;
                      const hasSubmenu = !!(item.submenu && item.submenu.length > 0);
                      const isActiveDirect = !hasSubmenu && isPathActive(item.path || '');

                      // 1. FLYOUT ITEM (Sub-contractor, Materials, Warehouse, etc. - NO "FLYOUT" text badge)
                      if (isFlyout) {
                        const isFlyoutOpen = flyoutMenu === item.id;
                        return (
                          <div key={item.id} className="relative">
                            <button
                              type="button"
                              onClick={handleClick(item)}
                              onMouseEnter={(e) => handleFlyoutEnter(item.id, e)}
                              onMouseLeave={handleFlyoutLeave}
                              className={cx(
                                "flyout-trigger group w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all text-left font-sans",
                                isCollapsed && "justify-center px-0 py-2",
                                parentActive || isFlyoutOpen
                                  ? "bg-emerald-50 text-emerald-950 border-l-2 border-emerald-600 border-y border-r border-slate-200 shadow-sm font-semibold"
                                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium"
                              )}
                              title={isCollapsed ? item.label : undefined}
                            >
                              <div className={cx("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
                                <span
                                  className={cx(
                                    "material-symbols-outlined text-[18px] shrink-0",
                                    (parentActive || isFlyoutOpen)
                                      ? "text-emerald-700"
                                      : "text-slate-400 group-hover:text-emerald-600 transition-colors"
                                  )}
                                >
                                  {iconName}
                                </span>
                                {!isCollapsed && <span className="truncate">{item.label}</span>}
                              </div>
                              {!isCollapsed && (
                                <span
                                  className={cx(
                                    "material-symbols-outlined text-[16px] transition-colors shrink-0",
                                    parentActive ? "text-emerald-800" : "text-slate-400 group-hover:text-slate-600"
                                  )}
                                >
                                  chevron_right
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 2. ACCORDION SUBMENU ITEM (Site report, Issues, Clients, Leads, etc.)
                      if (hasSubmenu) {
                        return (
                          <div key={item.id}>
                            <button
                              type="button"
                              onClick={handleClick(item)}
                              className={cx(
                                "group w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all text-left font-sans",
                                isCollapsed && "justify-center px-0 py-2",
                                parentActive && !isExpanded
                                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm font-semibold"
                                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium"
                              )}
                              title={isCollapsed ? item.label : undefined}
                            >
                              <div className={cx("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
                                <span
                                  className={cx(
                                    "material-symbols-outlined text-[18px] shrink-0",
                                    parentActive
                                      ? "text-emerald-600"
                                      : "text-slate-400 group-hover:text-emerald-600 transition-colors"
                                  )}
                                >
                                  {iconName}
                                </span>
                                {!isCollapsed && <span className="truncate">{item.label}</span>}
                              </div>
                              {!isCollapsed && (
                                <span
                                  className={cx(
                                    "material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200",
                                    isExpanded && "rotate-180"
                                  )}
                                >
                                  expand_more
                                </span>
                              )}
                            </button>

                            {/* Expanded Submenu items */}
                            {!isCollapsed && isExpanded && item.submenu && (
                              <div className="pl-7 pr-1 py-1 space-y-0.5 border-l border-slate-200 ml-3 my-0.5 font-sans">
                                {item.submenu.map(subItem => {
                                  const isSubActive = isPathActive(subItem.path);
                                  const hasNested = !!(subItem.submenu && subItem.submenu.length > 0);
                                  const isNestedExpanded = expandedMenus.includes(subItem.id);

                                  return (
                                    <div key={subItem.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (hasNested) {
                                            toggleMenu(subItem.id);
                                          } else {
                                            onNavigate(subItem.path);
                                          }
                                        }}
                                        className={cx(
                                          "w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors text-left truncate font-sans",
                                          isSubActive
                                            ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/60"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                        )}
                                      >
                                        <span className="truncate">{subItem.label}</span>
                                        {hasNested && (
                                          <span
                                            className={cx(
                                              "material-symbols-outlined text-[14px] text-slate-400 transition-transform duration-200",
                                              isNestedExpanded && "rotate-180"
                                            )}
                                          >
                                            expand_more
                                          </span>
                                        )}
                                      </button>

                                      {/* Level 3 nested items if any */}
                                      {hasNested && isNestedExpanded && subItem.submenu && (
                                        <div className="pl-3 py-0.5 space-y-0.5 border-l border-slate-200 ml-2 my-0.5">
                                          {subItem.submenu.map(nestedItem => (
                                            <button
                                              key={nestedItem.id}
                                              type="button"
                                              onClick={() => onNavigate(nestedItem.path)}
                                              className={cx(
                                                "block w-full text-left px-2 py-0.5 rounded text-[10.5px] transition-colors truncate font-sans",
                                                isPathActive(nestedItem.path)
                                                  ? "text-emerald-900 font-semibold bg-emerald-50"
                                                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                              )}
                                            >
                                              {nestedItem.label}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // 3. DIRECT LINK ITEM
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.path && onNavigate(item.path)}
                          className={cx(
                            "group flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all w-full text-left font-sans",
                            isCollapsed && "justify-center px-0 py-2",
                            isActiveDirect
                              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm font-semibold"
                              : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium"
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <div className={cx("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
                            <span
                              className={cx(
                                "material-symbols-outlined text-[18px] shrink-0",
                                isActiveDirect
                                  ? "text-emerald-600"
                                  : "text-slate-400 group-hover:text-emerald-600 transition-colors"
                              )}
                            >
                              {iconName}
                            </span>
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Sticky Settings & Collapse */}
          <div className="border-t border-slate-200 bg-slate-50/80 p-2 space-y-1 shrink-0 font-sans">
            {settingsSection && (
              <div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(prev => !prev)}
                  className={cx(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all text-left font-sans",
                    isCollapsed && "justify-center px-0 py-2",
                    isSettingsActive
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 font-medium"
                  )}
                  title={isCollapsed ? "Settings" : undefined}
                >
                  <div className={cx("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
                    <span
                      className={cx(
                        "material-symbols-outlined text-[18px] shrink-0",
                        isSettingsActive ? "text-emerald-600" : "text-slate-500"
                      )}
                    >
                      settings
                    </span>
                    {!isCollapsed && <span className="truncate">Settings</span>}
                  </div>
                  {!isCollapsed && (
                    <span
                      className={cx(
                        "material-symbols-outlined text-[16px] text-slate-500 transition-transform duration-200",
                        settingsOpen && "rotate-180"
                      )}
                    >
                      expand_less
                    </span>
                  )}
                </button>

                {/* Settings Accordion Dropdown */}
                {!isCollapsed && settingsOpen && (
                  <div className="pl-7 pr-1 py-1 space-y-0.5 max-h-44 overflow-y-auto sidebar-scroll border-l border-slate-200 ml-3 my-0.5 overflow-x-hidden font-sans">
                    {settingsSection.items.flatMap(item => item.submenu || [item]).map(subItem => (
                      <button
                        key={subItem.id}
                        type="button"
                        onClick={() => onNavigate(subItem.path || '/settings')}
                        className={cx(
                          "block w-full text-left px-2 py-0.5 rounded text-[11px] transition-colors truncate font-sans",
                          isPathActive(subItem.path || '')
                            ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/60"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                        )}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Collapse Button */}
            <button
              type="button"
              id="bottom-collapse-btn"
              onClick={onToggle}
              className={cx(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors font-sans",
                isCollapsed && "justify-center px-0 py-2"
              )}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <div className={cx("flex items-center gap-2", isCollapsed && "justify-center")}>
                <span className="material-symbols-outlined text-[18px]">
                  {isCollapsed ? "menu_open" : "left_panel_close"}
                </span>
                {!isCollapsed && <span className="collapse-label">Collapse Sidebar</span>}
              </div>
            </button>
          </div>
        </aside>

        {/* Dynamic Flyout Panel (Strict light enterprise theme matching code.html, pure Inter font) */}
        {flyoutMenu && activeFlyoutItem && (
          <div
            className="sidebar-flyout fixed z-50 bg-white border border-slate-200/90 rounded-r-lg rounded-b-lg flyout-shadow flex flex-col overflow-hidden transition-all duration-200 ring-1 ring-slate-900/5 font-sans"
            style={{
              ...flyoutPos,
              left: isCollapsed ? 64 : 256,
              width: 240,
            }}
            onMouseEnter={handleFlyoutPanelEnter}
            onMouseLeave={handleFlyoutPanelLeave}
          >
            {/* Header with Item Count */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 font-sans">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">
                  {ICON_MAP[activeFlyoutItem.id] || 'category'}
                </span>
                <span className="sidebar-flyout-title text-xs font-bold text-slate-900 uppercase tracking-wider truncate font-sans">
                  {activeFlyoutItem.label}
                </span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold shrink-0 font-sans">
                {activeFlyoutItem.submenu?.length || 0} items
              </span>
            </div>

            {/* Menu items */}
            <div className="p-1.5 space-y-0.5 font-sans overflow-y-auto max-h-[50vh] sidebar-scroll">
              {activeFlyoutItem.submenu?.map(sub => {
                const isSubActive = isPathActive(sub.path);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setFlyoutMenu(null);
                      onNavigate(sub.path);
                    }}
                    className={cx(
                      "sidebar-flyout-item w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors text-left font-sans",
                      isSubActive
                        ? "bg-emerald-50 text-emerald-950 font-semibold border border-emerald-200/60"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <span className="truncate">{sub.label}</span>
                    <span className="material-symbols-outlined text-[14px] text-slate-400">
                      arrow_forward
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
