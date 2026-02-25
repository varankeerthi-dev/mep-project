import { useState, useEffect } from 'react';

const menuData = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', path: '/' }
    ]
  },
  {
    section: 'Projects',
    items: [
      { 
        id: 'projects', 
        label: 'Project', 
        icon: 'folder',
        submenu: [
          { id: 'projects-new', label: 'New Project', path: '/projects/new' },
          { id: 'projects-list', label: 'Project List', path: '/projects' },
          { id: 'daily-updates', label: 'Daily Updates', path: '/projects/daily-updates' },
          { id: 'site-materials', label: 'Site Materials', path: '/projects/site-materials' }
        ]
      },
      { id: 'todo', label: 'To Do List', icon: 'check', path: '/todo' },
      { id: 'approvals', label: 'Approvals', icon: 'checkCircle', path: '/approvals' }
    ]
  },
  {
    section: 'Client',
    items: [
      { 
        id: 'clients', 
        label: 'Client', 
        icon: 'users',
        submenu: [
          { id: 'clients-new', label: 'Create Client', path: '/clients/new' },
          { id: 'clients-list', label: 'Client List', path: '/clients' }
        ]
      },
{
    id: 'meetings',
    label: 'Meetings',
    icon: 'calendar',
    submenu: [
      { id: 'meetings-dashboard', label: 'Dashboard', path: '/meetings' },
      { id: 'meetings-create', label: 'Create Meeting', path: '/meetings/create' }
    ]
  },
  {
    id: 'site-visit',
    label: 'Site Visit',
    icon: 'mapPin',
    submenu: [
      { id: 'site-visit-dashboard', label: 'Dashboard', path: '/site-visits' },
      { id: 'site-visit-create', label: 'New Visit', path: '/site-visits/new' }
    ]
  },
  {
    id: 'subcontractor',
    label: 'Sub-Contractor',
    icon: 'hardHat',
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
        icon: 'inbox',
        path: '/client-requests'
      }
    ]
  },
  {
    section: 'Documents',
    items: [
      { id: 'quotation', label: 'Quotation', icon: 'fileText', path: '/quotation' },
      { id: 'boq', label: 'BOQ', icon: 'list', path: '/boq' },
      { id: 'documents', label: 'Documents', icon: 'folderOpen', path: '/documents' },
      { id: 'issue', label: 'Issue', icon: 'alertCircle', path: '/issue' },
      { id: 'client-comm', label: 'Client Communication', icon: 'messageCircle', path: '/client-comm' }
    ]
  },
  {
    section: 'Material',
    items: [
      { 
        id: 'store', 
        label: 'Material', 
        icon: 'warehouse',
        submenu: [
          { id: 'materials-list', label: 'Items/Materials', path: '/store/materials' },
          { id: 'material-inward', label: 'Material Inward', path: '/store/inward' },
          { id: 'material-outward', label: 'Material Outward', path: '/store/outward' },
          { id: 'stock-transfer', label: 'Stock Transfer', path: '/store/transfer' },
          { id: 'stock-balance', label: 'Stock Balance', path: '/store/stock' }
        ]
      }
    ]
  },
  {
    section: 'Tools',
    items: [
      { id: 'tools', label: 'Tools', icon: 'tool', path: '/tools' }
    ]
  },
  {
    section: 'Delivery Challan',
    items: [
      { 
        id: 'dc', 
        label: 'Delivery Challan', 
        icon: 'truck',
        submenu: [
          { id: 'dc-create', label: 'Create DC', path: '/dc/create' },
          { id: 'dc-list', label: 'DC List', path: '/dc/list' },
          { id: 'dc-date-wise', label: 'Date-wise Consolidation', path: '/dc/consolidation/date' },
          { id: 'dc-material-wise', label: 'Material-wise Consolidation', path: '/dc/consolidation/material' }
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
        icon: 'chart',
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
      { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' }
    ]
  }
];

const icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  checkCircle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  fileText: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  folderOpen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>,
  alertCircle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  messageCircle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  warehouse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  tool: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  inbox: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  mapPin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  hardHat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3"/></svg>,
};

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle }) {
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile, currentPath]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleMenuClick = (item) => {
    if (item.submenu) {
      if (collapsed && !isMobile) {
        setHoveredMenu(item.id);
      } else {
        toggleMenu(item.id);
      }
    } else if (item.path) {
      onNavigate(item.path);
      if (isMobile) setMobileOpen(false);
    }
  };

  const handleSubmenuClick = (path) => {
    onNavigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const sidebarClass = `sidebar ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${mobileOpen ? 'mobile-open' : ''}`;

  return (
    <>
      {isMobile && !mobileOpen && (
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}
      
      {isMobile && mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside 
        className={sidebarClass}
        aria-expanded={collapsed ? 'false' : 'true'}
      >
        <div className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
          >
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>

        {menuData.map(section => (
          <div key={section.section} className="menu-section">
            {!collapsed && <div className="section-title">{section.section}</div>}
            {section.items.map(item => (
              <div key={item.id} className="menu-wrapper">
                <div 
                  className={`menu-item ${expandedMenus.includes(item.id) ? 'expanded' : ''} ${currentPath.startsWith(item.submenu?.[0]?.path?.split('/')[1] || item.path?.split('/')[1]) ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item)}
                  onMouseEnter={() => collapsed && !isMobile && setHoveredMenu(item.id)}
                  onMouseLeave={() => collapsed && !isMobile && setHoveredMenu(null)}
                  role="button"
                  aria-expanded={item.submenu ? expandedMenus.includes(item.id) : undefined}
                  aria-haspopup={item.submenu ? 'true' : undefined}
                >
                  {icons[item.icon]}
                  <span className="menu-text">{item.label}</span>
                  {item.submenu && <span className={`chevron ${expandedMenus.includes(item.id) ? 'rotated' : ''}`}>{icons.chevron}</span>}
                </div>
                
                {item.submenu && (
                  <div className={`submenu ${expandedMenus.includes(item.id) ? 'expanded' : ''} ${hoveredMenu === item.id && collapsed && !isMobile ? 'popover' : ''}`}>
                    <div className="submenu-title">{item.label}</div>
                    {item.submenu.map(subItem => (
                      <div
                        key={subItem.id}
                        className={`submenu-item ${currentPath === subItem.path ? 'active' : ''}`}
                        onClick={() => handleSubmenuClick(subItem.path)}
                      >
                        {subItem.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </aside>
    </>
  );
}
