import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Folder, Users, CheckSquare, FileText, List, 
  FolderOpen, AlertCircle, MessageCircle, Warehouse, 
  Tool, Truck, Chart, Settings, Calendar, Inbox, 
  MapPin, HardHat, ChevronDown, ChevronRight
} from 'lucide-react';

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
          { id: 'stock-balance', label: 'Stock Balance', path: '/store/stock' },
          { id: 'warehouses', label: 'Warehouses', path: '/store/materials?tab=warehouses' }
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
  home: Home,
  folder: Folder,
  users: Users,
  check: CheckSquare,
  checkCircle: CheckSquare,
  fileText: FileText,
  list: List,
  folderOpen: FolderOpen,
  alertCircle: AlertCircle,
  messageCircle: MessageCircle,
  warehouse: Warehouse,
  tool: Tool,
  truck: Truck,
  chart: Chart,
  settings: Settings,
  calendar: Calendar,
  inbox: Inbox,
  mapPin: MapPin,
  hardHat: HardHat,
};

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

  const IconComponent = ({ icon, size = 18, className = '' }) => {
    const Icon = icons[icon];
    return Icon ? <Icon size={size} className={className} /> : null;
  };

  if (collapsed) {
    return (
      <aside className="w-16 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md font-semibold">
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
                        className={`w-full flex items-center justify-center p-2 rounded-lg transition ${
                          isParentActive(item) ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <IconComponent icon={item.icon} />
                      </button>
                      {expandedMenus.includes(item.id) && (
                        <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]">
                          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                            {item.label}
                          </div>
                          {item.submenu.map(subItem => (
                            <Link
                              key={subItem.id}
                              to={subItem.path}
                              className={`block px-3 py-2 text-sm transition ${
                                isActive(subItem.path) 
                                  ? 'bg-blue-50 text-blue-600 font-medium' 
                                  : 'text-gray-700 hover:bg-gray-50'
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
                      className={`w-full flex items-center justify-center p-2 rounded-lg transition ${
                        isActive(item.path) ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent icon={item.icon} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <button
          onClick={onToggle}
          className="p-3 border-t border-gray-200 text-gray-600 hover:bg-gray-100"
        >
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-md font-semibold">
          M
        </div>
        <span className="ml-3 text-lg font-semibold text-gray-900">
          MEP Projects
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {menuData.map(section => (
          <div key={section.section}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              {section.section}
            </p>
            
            <div className="space-y-1">
              {section.items.map(item => (
                <div key={item.id}>
                  {item.submenu ? (
                    <>
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition ${
                          isParentActive(item) 
                            ? 'bg-gray-200 text-gray-900' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent icon={item.icon} />
                          {item.label}
                        </div>
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${
                            expandedMenus.includes(item.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      {expandedMenus.includes(item.id) && (
                        <div className="ml-8 mt-1 space-y-1">
                          {item.submenu.map(subItem => (
                            <Link
                              key={subItem.id}
                              to={subItem.path}
                              className={`block px-3 py-2 rounded-lg text-sm transition ${
                                isActive(subItem.path) 
                                  ? 'bg-gray-200 text-gray-900 font-medium' 
                                  : 'text-gray-600 hover:bg-gray-100'
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition ${
                        isActive(item.path) 
                          ? 'bg-gray-200 text-gray-900' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent icon={item.icon} />
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
        className="p-3 border-t border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
      >
        <ChevronDown size={18} className="rotate-90" />
      </button>
    </aside>
  );
}
