import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WarehouseModule from './WarehouseModule';

vi.mock('./components/GlobalSearchBar', () => ({
  default: () => <div data-testid="global-search" />,
}));

vi.mock('../components/ui/SubTabsNav', () => ({
  SubTabsNav: () => <nav data-testid="warehouse-tabs" />,
}));

vi.mock('./pages/WarehouseDashboardPage', () => ({
  default: () => <div data-page="dashboard" />,
}));

vi.mock('./pages/WarehouseDesignerPage', () => ({
  default: () => <div data-page="designer" />,
}));

vi.mock('./pages/WarehouseListPage', () => ({
  default: () => <div data-page="warehouses" />,
}));

vi.mock('./pages/WarehouseViewerPage', () => ({
  default: () => <div data-page="viewer" />,
}));

vi.mock('./pages/InventoryPage', () => ({
  default: () => <div data-page="inventory" />,
}));

vi.mock('./pages/OperationsPage', () => ({
  default: () => <div data-page="operations" />,
}));

vi.mock('./pages/WarehouseReportsPage', () => ({
  default: () => <div data-page="reports" />,
}));

vi.mock('./stock-requests/StockRequestListPage', () => ({
  default: () => <div data-page="stock-requests" />,
}));

vi.mock('./stock-requests/StockRequestDetailPage', () => ({
  default: () => <div data-page="stock-request-detail" />,
}));

vi.mock('./stock-requests/FulfillmentQueuePage', () => ({
  default: () => <div data-page="fulfillment" />,
}));

describe('WarehouseModule', () => {
  it.each([
    { route: '/warehouse/dashboard', page: 'dashboard' },
    { route: '/warehouse/stock-requests', page: 'stock-requests' },
    { route: '/warehouse/fulfillment', page: 'fulfillment' },
    { route: '/warehouse/designer', page: 'designer' },
    { route: '/warehouse/viewer', page: 'viewer' },
    { route: '/warehouse/inventory', page: 'inventory' },
    { route: '/warehouse/operations', page: 'operations' },
    { route: '/warehouse/reports', page: 'reports' },
    { route: '/warehouse/warehouses', page: 'warehouses' },
  ])('renders only the $page panel for $route', ({ route, page }) => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="*" element={<WarehouseModule />} />
        </Routes>
      </MemoryRouter>,
    );

    const renderedPanels = markup.match(/data-page="[^"]+"/g) ?? [];
    expect(renderedPanels).toEqual([`data-page="${page}"`]);
  });
});
