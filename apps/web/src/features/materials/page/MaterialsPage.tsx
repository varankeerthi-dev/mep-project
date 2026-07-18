import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMaterialsTabFromSearch } from '../shared/constants';
import { TabButton } from '../shared/TabButton';
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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-1 flex flex-wrap gap-[20px] shadow-sm">
        <TabButton active={activeTab === 'items'} onClick={() => changeTab('items')}>Items</TabButton>
        <TabButton active={activeTab === 'service'} onClick={() => changeTab('service')}>Service</TabButton>
        <TabButton active={activeTab === 'category'} onClick={() => changeTab('category')}>Category</TabButton>
        <TabButton active={activeTab === 'unit'} onClick={() => changeTab('unit')}>Unit</TabButton>
        <TabButton active={activeTab === 'warehouses'} onClick={() => changeTab('warehouses')}>Warehouses</TabButton>
        <TabButton active={activeTab === 'variants'} onClick={() => changeTab('variants')}>Variants</TabButton>
        <TabButton active={activeTab === 'discount-categories'} onClick={() => changeTab('discount-categories')}>Discount Categories</TabButton>
        <TabButton active={activeTab === 'inward'} onClick={() => changeTab('inward')}>Material Inward</TabButton>
        <TabButton active={activeTab === 'outward'} onClick={() => changeTab('outward')}>Material Outward</TabButton>
        <TabButton active={activeTab === 'stock-transfer'} onClick={() => changeTab('stock-transfer')}>Stock Transfer</TabButton>
        <TabButton active={activeTab === 'stock-balance'} onClick={() => changeTab('stock-balance')}>Stock Balance</TabButton>
        <TabButton active={activeTab === 'stock-check'} onClick={() => changeTab('stock-check')}>Stock Check</TabButton>
        <TabButton active={activeTab === 'stock-adjust'} onClick={() => changeTab('stock-adjust')}>Stock Adjustment</TabButton>
      </div>

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
