export interface ColumnDef {
  key: string;
  label: string;
  default: boolean;
  locked?: boolean;
}

export const ITEM_TABLE_COLUMNS: ColumnDef[] = [
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
