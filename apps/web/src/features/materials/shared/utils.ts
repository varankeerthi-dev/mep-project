import { formatCurrency } from '../../../utils/formatters';

export const formatCurrencyOrDash = (value: any) => {
  if (value === null || value === undefined || value === '' || value === 0) return '-';
  return formatCurrency(value);
};

export const generateItemCode = () => {
  return 'ITEM-' + Date.now().toString(36).toUpperCase();
};

export const generateWarehouseCode = () => 'WH-' + Date.now().toString(36).toUpperCase();

export const generateSelectiveTemplate = (selectedFields: string[]) => {
  const columns = [
    { key: 'item_code', label: 'Item Code / SKU' },
    { key: 'name', label: 'Item Name' },
    ...selectedFields.map(field => {
      if (field.startsWith('stock_')) {
        return { key: field, label: field };
      }
      const colDef = [
        { key: 'display_name', label: 'Display Name' },
        { key: 'main_category', label: 'Main Category' },
        { key: 'sub_category', label: 'Sub Category' },
        { key: 'size', label: 'Size' },
        { key: 'size_lwh', label: 'Size (L x W x H)' },
        { key: 'pressure_class', label: 'Pressure Class' },
        { key: 'make', label: 'Make/Brand' },
        { key: 'material', label: 'Material' },
        { key: 'end_connection', label: 'End Connection' },
        { key: 'unit', label: 'Unit' },
        { key: 'sale_price', label: 'Sale Price' },
        { key: 'purchase_price', label: 'Purchase Price' },
        { key: 'hsn_code', label: 'HSN/SAC Code' },
        { key: 'gst_rate', label: 'GST Rate (%)' },
        { key: 'part_number', label: 'Part Number' },
        { key: 'taxable', label: 'Taxable Status' },
        { key: 'weight', label: 'Weight' },
        { key: 'upc', label: 'UPC' },
        { key: 'mpn', label: 'MPN' },
        { key: 'ean', label: 'EAN' },
        { key: 'inventory_account', label: 'Inventory Account' },
        { key: 'is_active', label: 'Is Active' },
        { key: 'low_stock_level', label: 'Low Stock Level' },
      ].find(c => c.key === field);
      return colDef || { key: field, label: field };
    }),
  ].filter(Boolean);
  
  const headers = columns.map(c => c.label);
  const sampleRow = columns.map(c => {
    switch (c.key) {
      case 'item_code': return 'ITEM-001';
      case 'name': return 'Sample Item';
      case 'display_name': return 'Sample Display Name';
      case 'main_category': return 'VALVE';
      case 'sale_price': return '1250.00';
      case 'purchase_price': return '980.00';
      case 'gst_rate': return '18';
      case 'is_active': return 'true';
      default: return '';
    }
  });
  
  const content = [headers.join('\t'), sampleRow.join('\t')].join('\n');
  const blob = new Blob([content], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selective_item_template.txt';
  a.click();
  URL.revokeObjectURL(url);
};
