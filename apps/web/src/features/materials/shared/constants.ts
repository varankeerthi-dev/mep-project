export const MAIN_CATEGORIES = ['VALVE', 'PIPE', 'FITTING', 'FLANGE', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE PROTECTION', 'BUILDING MATERIALS', 'TOOLS', 'SAFETY', 'OFFICE', 'OTHER'];

export const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 0.5, label: '0.5%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

export const ITEM_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'warehouse', label: 'Warehouse Report' },
  { key: 'adjustments', label: 'Stock Adjustments' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'purchase', label: 'Purchase Details' },
  { key: 'challan', label: 'Delivery Challan' },
  { key: 'audit', label: 'Audit Trail' },
];

export const ITEM_TABLE_COLUMNS = [
  { key: 'name', label: 'Item Name', default: true, locked: true },
  { key: 'category', label: 'Category', default: true, locked: true },
  { key: 'unit', label: 'Unit', default: true, locked: true },
  { key: 'gst_rate', label: 'GST Rate', default: true },
  { key: 'hsn_code', label: 'HSN/SAC', default: true },
  { key: 'uses_variant', label: 'Discount Category', default: true },
  { key: 'stock', label: 'Inventory', default: true },
  { key: 'code', label: 'Code', default: false },
  { key: 'sub_category', label: 'Sub Category', default: false },
  { key: 'size', label: 'Size', default: false },
  { key: 'pressure_class', label: 'Pressure Class', default: false },
  { key: 'make', label: 'MAKE(Brand name)', default: false },
  { key: 'material', label: 'Material', default: false },
  { key: 'end_connection', label: 'End Connection', default: false },
  { key: 'sale_price', label: 'Sale Price', default: false },
  { key: 'purchase_price', label: 'Purchase Price', default: false },
  { key: 'status', label: 'Status', default: true },
  { key: 'actions', label: 'Actions', default: true, locked: true },
];

export const MANDATORY_ITEM_COLUMNS = ['name', 'category', 'unit', 'actions'];

export const ITEM_AUDIT_STORAGE_KEY = 'items_audit_trail_v1';

export const emptyItemTransactions = () => ({
  warehouseRows: [],
  adjustmentRows: [],
  quotationRows: [],
  invoiceRows: [],
  purchaseRows: [],
  challanRows: [],
  auditRows: [],
});

export const CLASSIFICATION_OPTIONS = [
  { value: 'finished_good', label: 'Finished Good', desc: 'Manufactured and sold', requiresMfg: true },
  { value: 'raw_material', label: 'Raw Material', desc: 'Purchased, consumed in production, appears in BOM', requiresMfg: true },
  { value: 'consumable', label: 'Consumable', desc: 'Purchased, used for operations/maintenance, not in BOM', requiresMfg: false },
  { value: 'goods_sold', label: 'Goods Sold', desc: 'Purchased and resold as-is', requiresMfg: false },
];

export const getMaterialsTabFromSearch = (search = '') => {
  const tab = new URLSearchParams(search || '').get('tab');
  const allowedTabs = new Set(['items', 'service', 'category', 'unit', 'warehouses', 'variants', 'discount-categories', 'inward', 'outward', 'stock-transfer', 'stock-balance', 'stock-check', 'stock-adjust']);
  return allowedTabs.has(tab) ? tab : 'items';
};
