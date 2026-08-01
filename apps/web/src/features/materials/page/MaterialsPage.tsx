import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMaterialsTabFromSearch } from '../shared/constants';
import { SubTabsNav } from '../../../components/ui/SubTabsNav';
import { ItemsTab } from './ItemsTab';
import { ServiceTab } from '../service/ServiceTab';
import { CategoryTab } from '../settings/CategoryTab';
import { UnitTab } from '../settings/UnitTab';
import { WarehousesTab } from '../settings/WarehouseTab';
import { VariantsTab } from '../settings/VariantsTab';
import { DiscountCategoriesTab } from '../settings/DiscountCategoriesTab';
import MaterialInward from '../../../pages/MaterialInward';
import MaterialOutward from '../../../pages/MaterialOutward';
import StockTransfer from '../../../pages/StockTransfer';
import { StockBalance } from '../../../pages/Reports';
import QuickStockCheck from '../../../pages/QuickStockCheck';
import StockAdjustmentPage from '../../../pages/StockAdjustment';

export default function MaterialsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationSearch = location.search;
  const activeTab = useMemo(() => getMaterialsTabFromSearch(locationSearch), [locationSearch]);

  const changeTab = (tab: string) => {
    navigate(`/store/materials?tab=${tab}`);
  };

  const tabs = [
    { id: 'items', label: 'Items', path: '/store/materials?tab=items' },
    { id: 'service', label: 'Service', path: '/store/materials?tab=service' },
    { id: 'category', label: 'Category', path: '/store/materials?tab=category' },
    { id: 'unit', label: 'Unit', path: '/store/materials?tab=unit' },
    { id: 'warehouses', label: 'Warehouses', path: '/store/materials?tab=warehouses' },
    { id: 'variants', label: 'Variants', path: '/store/materials?tab=variants' },
    { id: 'discount-categories', label: 'Discount Categories', path: '/store/materials?tab=discount-categories' },
    { id: 'inward', label: 'Material Inward', path: '/store/materials?tab=inward' },
    { id: 'outward', label: 'Material Outward', path: '/store/materials?tab=outward' },
    { id: 'stock-transfer', label: 'Stock Transfer', path: '/store/materials?tab=stock-transfer' },
    { id: 'stock-balance', label: 'Stock Balance', path: '/store/materials?tab=stock-balance' },
    { id: 'stock-check', label: 'Stock Check', path: '/store/materials?tab=stock-check' },
    { id: 'stock-adjust', label: 'Stock Adjustment', path: '/store/materials?tab=stock-adjust' }
  ];

  return (
    <div className="space-y-6">
      <SubTabsNav
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={(tab) => changeTab(tab.id)}
      />

      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'service' && <ServiceTab />}
      {activeTab === 'category' && <CategoryTab />}
      {activeTab === 'unit' && <UnitTab />}
      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'variants' && <VariantsTab />}
      {activeTab === 'discount-categories' && <DiscountCategoriesTab />}
      {activeTab === 'inward' && <MaterialInward onSuccess={() => changeTab('items')} onCancel={() => changeTab('items')} />}
      {activeTab === 'outward' && <MaterialOutward onSuccess={() => changeTab('items')} onCancel={() => changeTab('items')} />}
      {activeTab === 'stock-transfer' && <StockTransfer />}
      {activeTab === 'stock-balance' && <StockBalance />}
      {activeTab === 'stock-check' && <QuickStockCheck />}
      {activeTab === 'stock-adjust' && <StockAdjustmentPage />}
    </div>
  );
}
