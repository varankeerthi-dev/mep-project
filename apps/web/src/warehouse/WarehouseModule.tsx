// src/warehouse/WarehouseModule.tsx
// Warehouse Management module shell. Follows the feature-first module
// pattern used by ManufacturingShell: SubTabsNav + route-based panels.
//
// Module navigation (PRD §2.4): Dashboard is the default landing page.
// The shell hosts the phase-1..5 screens: Dashboard, Designer, Viewer,
// Inventory, Operations (+ picking/dispatch/replenishment), Warehouses.

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SubTabsNav } from '../components/ui/SubTabsNav';
import GlobalSearchBar from './components/GlobalSearchBar';
import WarehouseDashboardPage from './pages/WarehouseDashboardPage';
import WarehouseDesignerPage from './pages/WarehouseDesignerPage';
import WarehouseListPage from './pages/WarehouseListPage';
import WarehouseViewerPage from './pages/WarehouseViewerPage';
import InventoryPage from './pages/InventoryPage';
import OperationsPage from './pages/OperationsPage';
import WarehouseReportsPage from './pages/WarehouseReportsPage';
import StockRequestListPage from './stock-requests/StockRequestListPage';
import StockRequestDetailPage from './stock-requests/StockRequestDetailPage';
import FulfillmentQueuePage from './stock-requests/FulfillmentQueuePage';

type Tab = {
  id: string;
  label: string;
  path: string;
  matchPrefix: string;
};

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/warehouse/dashboard', matchPrefix: '/warehouse/dashboard' },
  { id: 'stock-requests', label: 'Stock Requests', path: '/warehouse/stock-requests', matchPrefix: '/warehouse/stock-requests' },
  { id: 'fulfillment', label: 'Fulfillment', path: '/warehouse/fulfillment', matchPrefix: '/warehouse/fulfillment' },
  { id: 'designer', label: 'Designer', path: '/warehouse/designer', matchPrefix: '/warehouse/designer' },
  { id: 'viewer', label: 'Viewer', path: '/warehouse/viewer', matchPrefix: '/warehouse/viewer' },
  { id: 'inventory', label: 'Inventory', path: '/warehouse/inventory', matchPrefix: '/warehouse/inventory' },
  { id: 'operations', label: 'Operations', path: '/warehouse/operations', matchPrefix: '/warehouse/operations' },
  { id: 'reports', label: 'Reports', path: '/warehouse/reports', matchPrefix: '/warehouse/reports' },
  { id: 'warehouses', label: 'Warehouses', path: '/warehouse/warehouses', matchPrefix: '/warehouse/warehouses' },
];

export default function WarehouseModule() {
  const location = useLocation();
  const pathKey = location.pathname;

  const isStockRequestDetail =
    pathKey.startsWith('/warehouse/stock-requests/') &&
    pathKey !== '/warehouse/stock-requests' &&
    pathKey !== '/warehouse/stock-requests/';

  const stockRequestId = isStockRequestDetail
    ? pathKey.split('/warehouse/stock-requests/')[1]?.split('/')[0]
    : undefined;

  const activeTab = useMemo(() => {
    const exact = TABS.find(t => pathKey === t.path);
    if (exact) return exact;
    const best = TABS.find(t => pathKey.startsWith(t.matchPrefix + '/'));
    return best || TABS[0];
  }, [pathKey]);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="px-[5px] py-0">
        {/* PRD §2.8 — universal quick search on every screen */}
        <div className="mb-2">
          <GlobalSearchBar />
        </div>
        <SubTabsNav tabs={TABS} activeTabId={activeTab.id} />

        {isStockRequestDetail ? (
          <StockRequestDetailPage requestId={stockRequestId} />
        ) : (
          <>
            <div style={{ display: activeTab.id === 'dashboard' ? undefined : 'none' }}>
              <WarehouseDashboardPage />
            </div>
            <div style={{ display: activeTab.id === 'stock-requests' ? undefined : 'none' }}>
              <StockRequestListPage />
            </div>
            <div style={{ display: activeTab.id === 'fulfillment' ? undefined : 'none' }}>
              <FulfillmentQueuePage />
            </div>
            <div style={{ display: activeTab.id === 'designer' ? undefined : 'none' }}>
              <WarehouseDesignerPage />
            </div>
            <div style={{ display: activeTab.id === 'viewer' ? undefined : 'none' }}>
              <WarehouseViewerPage />
            </div>
            <div style={{ display: activeTab.id === 'inventory' ? undefined : 'none' }}>
              <InventoryPage />
            </div>
            <div style={{ display: activeTab.id === 'operations' ? undefined : 'none' }}>
              <OperationsPage />
            </div>
            <div style={{ display: activeTab.id === 'reports' ? undefined : 'none' }}>
              <WarehouseReportsPage />
            </div>
            <div style={{ display: activeTab.id === 'warehouses' ? undefined : 'none' }}>
              <WarehouseListPage />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
