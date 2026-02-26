import { useState } from 'react';

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
      { id: 'quotation', label: 'Quotation', path: '/quotation' },
      { id: 'boq', label: 'BOQ', path: '/boq' },
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
      { id: 'settings', label: 'Settings', path: '/settings' }
    ]
  }
];

function ChevronDownIcon({ style }) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      style={style}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle }) {
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
      return item.submenu.some(sub => currentPath === sub.path || currentPath.startsWith(sub.path));
    }
    return item.path && (currentPath === item.path || currentPath.startsWith(item.path));
  };

  const isActive = (path) => {
    return currentPath === path || currentPath.startsWith(path);
  };

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

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {menuData.map(section => (
        <div key={section.section} className="sidebar-section">
          <div className="sidebar-section-title">
            {section.section}
          </div>

          {section.items.map(item => {
            const parentActive = isParentActive(item);
            const isExpanded = expandedMenus.includes(item.id);

            return (
              <div key={item.id}>
                {item.submenu ? (
                  <>
                    <div
                      className={`sidebar-item ${parentActive ? "active" : ""}`}
                      onClick={() => handleClick(item)}
                    >
                      <span>{item.label}</span>
                      <ChevronDownIcon
                        style={{
                          marginLeft: "auto",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "0.2s ease"
                        }}
                      />
                    </div>

                    {isExpanded && (
                      <div style={{ paddingLeft: collapsed ? 0 : 18 }}>
                        {item.submenu.map(subItem => (
                          <div
                            key={subItem.id}
                            className={`sidebar-item ${
                              isActive(subItem.path) ? "active" : ""
                            }`}
                            onClick={() => handleSubmenuClick(subItem.path)}
                            style={{
                              fontSize: "13px",
                              opacity: 0.9
                            }}
                          >
                            <span>{subItem.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    className={`sidebar-item ${
                      isActive(item.path) ? "active" : ""
                    }`}
                    onClick={() => handleClick(item)}
                  >
                    <span>{item.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div
        className="sidebar-toggle"
        onClick={onToggle}
      >
        <ChevronDownIcon
          style={{
            transform: collapsed ? "rotate(90deg)" : "rotate(-90deg)",
            transition: "0.2s ease"
          }}
        />
      </div>
    </aside>
  );
}
