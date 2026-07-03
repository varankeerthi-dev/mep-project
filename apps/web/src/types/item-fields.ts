// TypeScript interface extension for the new item fields
// Add these to your existing Materials/Item type definitions

export interface ItemFields {
  // Existing fields...
  
  // New fields added
  taxable: 'taxable' | 'non-taxable' | 'non-gst supply';
  size_lwh: string; // Format: "L x W x H"
  weight: number;
  upc: string;
  mpn: string;
  ean: string;
  inventory_account: 'finished goods' | 'inventory asset' | 'work in progress';
}

// Dropdown options for forms
export const TAXABLE_OPTIONS = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'non-taxable', label: 'Non-Taxable' },
  { value: 'non-gst supply', label: 'Non-GST Supply' }
];

export const INVENTORY_ACCOUNT_OPTIONS = [
  { value: 'finished goods', label: 'Finished Goods' },
  { value: 'inventory asset', label: 'Inventory Asset' },
  { value: 'work in progress', label: 'Work in Progress' }
];

// Default values
export const DEFAULT_ITEM_VALUES = {
  taxable: 'taxable',
  inventory_account: 'inventory asset'
};
