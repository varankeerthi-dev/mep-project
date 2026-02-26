import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggle }) {
  const location = useLocation();
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

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => {
    if (item.submenu) {
      return item.submenu.some(sub => isActive(sub.path));
    }
    return item.path && isActive(item.path);
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleMenuClick = (item) => {
    if (item.submenu) {
      toggleMenu(item.id);
    } else if (item.path) {
      onNavigate(item.path);
    }
  };

  if (collapsed) {
    return (
      <aside className="w-20 h-screen bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="h-16 flex items-center justify-center border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="w-10 h-10 bg-white text-blue-600 flex items-center justify-center rounded-lg font-bold text-xl shadow">
            M
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {menuData.map(section => (
            <div key={section.section}>
              {section.items.map(item => (
                <div key={item.id} className="relative">
                  {item.submenu ? (
                    <>
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className={`w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                          isParentActive(item) ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <span className="font-semibold text-sm">{item.label.charAt(0)}</span>
                      </button>
                      {expandedMenus.includes(item.id) && (
                        <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 min-w-[200px]">
                          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                            {item.label}
                          </div>
                          {item.submenu.map(subItem => (
                            <Link
                              key={subItem.id}
                              to={subItem.path}
                              className={`block px-4 py-2.5 text-sm transition-all duration-200 ${
                                isActive(subItem.path) 
                                  ? 'bg-blue-50 text-blue-600 font-medium' 
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      to={item.path}
                      className={`w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                        isActive(item.path) ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-semibold text-sm">{item.label.charAt(0)}</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <button
          onClick={onToggle}
          className="p-4 border-t border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight size={20} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="w-9 h-9 bg-white text-blue-600 flex items-center justify-center rounded-lg font-bold text-lg shadow">
          M
        </div>
        <span className="ml-3 text-lg font-bold text-white">
          MEP Projects
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {menuData.map(section => (
          <div key={section.section}>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">
              {section.section}
            </p>
            
            <div className="space-y-1">
              {section.items.map(item => (
                <div key={item.id}>
                  {item.submenu ? (
                    <>
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                          isParentActive(item) 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${
                            expandedMenus.includes(item.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      {expandedMenus.includes(item.id) && (
                        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                          {item.submenu.map(subItem => (
                            <Link
                              key={subItem.id}
                              to={subItem.path}
                              className={`block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive(subItem.path) 
                                  ? 'bg-blue-50 text-blue-600 font-medium' 
                                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      to={item.path}
                      className={`flex items-center px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                        isActive(item.path) 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="p-3 border-t border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center transition-colors"
      >
        <ChevronDown size={18} className="rotate-90" />
      </button>
    </aside>
  );
}
