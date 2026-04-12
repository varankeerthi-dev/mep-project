import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { timedSupabaseQuery } from '../utils/queryTimeout';

export interface BulkImportRow {
  rowNo: number;
  action: 'create' | 'update' | 'skip' | 'error';
  identifier: string;
  item?: any;
  data: any;
  errors: string[];
  warnings: string[];
}

export interface ImportValidationResult {
  validRows: BulkImportRow[];
  errorRows: BulkImportRow[];
  summary: {
    total: number;
    toCreate: number;
    toUpdate: number;
    errors: number;
    warnings: number;
  };
}

// Required columns for item import
const REQUIRED_COLUMNS = ['item_code', 'name'];

// All available columns for import
// Variant columns (uses_variant, variant_name, variant_make, variant_sale_price, variant_purchase_price)
// use the "Option A" flat exploded format:
//   one row per item-variant pair. The importer groups by item_code and upserts item_variant_pricing.
const IMPORT_COLUMNS = [
  { key: 'item_code', label: 'Item Code', required: true, type: 'string' },
  { key: 'name', label: 'Item Name', required: true, type: 'string' },
  { key: 'display_name', label: 'Display Name', required: false, type: 'string' },
  { key: 'main_category', label: 'Main Category', required: false, type: 'string' },
  { key: 'sub_category', label: 'Sub Category', required: false, type: 'string' },
  { key: 'size', label: 'Size', required: false, type: 'string' },
  { key: 'size_lwh', label: 'Size (L x W x H)', required: false, type: 'string' },
  { key: 'pressure_class', label: 'Pressure Class', required: false, type: 'string' },
  { key: 'make', label: 'Make/Brand', required: false, type: 'string' },
  { key: 'material', label: 'Material', required: false, type: 'string' },
  { key: 'end_connection', label: 'End Connection', required: false, type: 'string' },
  { key: 'unit', label: 'Unit', required: false, type: 'string', default: 'nos' },
  { key: 'sale_price', label: 'Sale Price', required: false, type: 'number' },
  { key: 'purchase_price', label: 'Purchase Price', required: false, type: 'number' },
  { key: 'hsn_code', label: 'HSN/SAC Code', required: false, type: 'string' },
  { key: 'gst_rate', label: 'GST Rate (%)', required: false, type: 'number' },
  { key: 'part_number', label: 'Part Number', required: false, type: 'string' },
  { key: 'taxable', label: 'Taxable Status', required: false, type: 'dropdown', 
    options: ['taxable', 'non-taxable', 'non-gst supply'] },
  { key: 'weight', label: 'Weight', required: false, type: 'number' },
  { key: 'upc', label: 'UPC', required: false, type: 'string' },
  { key: 'mpn', label: 'MPN', required: false, type: 'string' },
  { key: 'ean', label: 'EAN', required: false, type: 'string' },
  { key: 'inventory_account', label: 'Inventory Account', required: false, type: 'dropdown',
    options: ['finished goods', 'inventory asset', 'work in progress'] },
  { key: 'is_active', label: 'Is Active', required: false, type: 'boolean', default: true },
  { key: 'low_stock_level', label: 'Low Stock Level', required: false, type: 'number' },
  { key: 'current_stock', label: 'Current Stock', required: false, type: 'number' },
  { key: 'warehouse', label: 'Warehouse', required: false, type: 'string' },
  // --- Variant pricing columns (flat/exploded format) ---
  { key: 'uses_variant', label: 'Uses Variant', required: false, type: 'boolean' },
  { key: 'variant_name', label: 'Variant Name', required: false, type: 'string' },
  { key: 'variant_make', label: 'Variant Make/Brand', required: false, type: 'string' },
  { key: 'variant_sale_price', label: 'Variant Sale Price', required: false, type: 'number' },
  { key: 'variant_purchase_price', label: 'Variant Purchase Price', required: false, type: 'number' },
];

// Column mapping for flexible header matching
const COLUMN_ALIASES: Record<string, string[]> = {
  'item_code': ['item_code', 'itemcode', 'code', 'item id', 'sku', 'product code'],
  'name': ['name', 'item name', 'product name', 'description'],
  'display_name': ['display_name', 'display name', 'shown name'],
  'main_category': ['main_category', 'category', 'main category', 'type'],
  'sub_category': ['sub_category', 'sub category', 'subcategory'],
  'size': ['size', 'dimension'],
  'size_lwh': ['size_lwh', 'lwh', 'l x w x h', 'dimensions', 'l*w*h'],
  'pressure_class': ['pressure_class', 'pressure class', 'pressure', 'class'],
  'make': ['make', 'brand', 'manufacturer', 'mfg'],
  'material': ['material', 'mat'],
  'end_connection': ['end_connection', 'end connection', 'connection'],
  'unit': ['unit', 'uom', 'unit of measure', 'measurement'],
  'sale_price': ['sale_price', 'sale price', 'selling price', 'sales price', 'price'],
  'purchase_price': ['purchase_price', 'purchase price', 'buying price', 'cost price', 'cost'],
  'hsn_code': ['hsn_code', 'hsn', 'sac', 'hsn/sac', 'hsn code'],
  'gst_rate': ['gst_rate', 'gst', 'gst rate', 'tax rate', 'gst%'],
  'part_number': ['part_number', 'part no', 'partno', 'part #'],
  'taxable': ['taxable', 'tax status', 'tax type', 'gst status'],
  'weight': ['weight', 'wt'],
  'upc': ['upc', 'barcode', 'universal product code'],
  'mpn': ['mpn', 'manufacturer part number', 'mfr part #'],
  'ean': ['ean', 'european article number'],
  'inventory_account': ['inventory_account', 'inventory account', 'inv account', 'stock account'],
  'is_active': ['is_active', 'active', 'status', 'enabled'],
  'low_stock_level': ['low_stock_level', 'low stock', 'reorder level', 'min stock'],
  'current_stock': ['current_stock', 'stock', 'quantity', 'qty', 'current qty', 'stock qty'],
  'warehouse': ['warehouse', 'location', 'store', 'godown'],
  // Variant columns
  'uses_variant': ['uses_variant', 'uses variant', 'variant item', 'has variant', 'is variant'],
  'variant_name': ['variant_name', 'variant name', 'variant', 'color', 'colour', 'grade'],
  'variant_make': ['variant_make', 'variant make', 'variant brand', 'variant manufacturer'],
  'variant_sale_price': ['variant_sale_price', 'variant sale price', 'variant selling price'],
  'variant_purchase_price': ['variant_purchase_price', 'variant purchase price', 'variant cost'],
};

export const validateNumeric = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
};

export const validateBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return ['true', 'yes', '1', 'active', 'enabled', 'y'].includes(str);
};

export const validateDropdown = (value: any, options: string[]): string | null => {
  if (!value) return null;
  const str = String(value).toLowerCase().trim();
  const match = options.find(opt => opt.toLowerCase() === str);
  return match || null;
};

export const mapColumnHeader = (header: string): string | null => {
  const normalized = header.toLowerCase().trim().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
  
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
      return key;
    }
  }
  return null;
};

export const generateImportTemplate = (): string => {
  const headers = IMPORT_COLUMNS.map(col => col.label);
  // Row 1: flat item (no variant)
  const sampleRow1 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'ITEM-001';
    if (col.key === 'name') return 'Sample Item';
    if (col.key === 'display_name') return 'Sample Display Name';
    if (col.key === 'main_category') return 'VALVE';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'sale_price') return '100.00';
    if (col.key === 'purchase_price') return '80.00';
    if (col.key === 'gst_rate') return '18';
    if (col.key === 'is_active') return 'Yes';
    if (col.key === 'taxable') return 'taxable';
    if (col.key === 'inventory_account') return 'inventory asset';
    if (col.key === 'uses_variant') return 'No';
    return '';
  });
  // Row 2: variant item - Green
  const sampleRow2 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'name') return 'Coupling 32mm';
    if (col.key === 'main_category') return 'FITTING';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'gst_rate') return '18';
    if (col.key === 'is_active') return 'Yes';
    if (col.key === 'uses_variant') return 'Yes';
    if (col.key === 'variant_name') return 'Green';
    if (col.key === 'variant_sale_price') return '150.00';
    if (col.key === 'variant_purchase_price') return '120.00';
    return '';
  });
  // Row 3: variant item - Blue (same item_code, second variant)
  const sampleRow3 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'name') return 'Coupling 32mm';
    if (col.key === 'uses_variant') return 'Yes';
    if (col.key === 'variant_name') return 'Blue';
    if (col.key === 'variant_sale_price') return '160.00';
    if (col.key === 'variant_purchase_price') return '130.00';
    return '';
  });
  
  return [headers.join('\t'), sampleRow1.join('\t'), sampleRow2.join('\t'), sampleRow3.join('\t')].join('\n');
};

export const generateImportTemplateCSV = (): string => {
  const headers = IMPORT_COLUMNS.map(col => col.key);
  const sampleRow1 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'ITEM-001';
    if (col.key === 'name') return 'Sample Item';
    if (col.key === 'main_category') return 'VALVE';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'sale_price') return '100.00';
    if (col.key === 'is_active') return 'true';
    if (col.key === 'uses_variant') return 'false';
    return '';
  });
  const sampleRow2 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'name') return 'Coupling 32mm';
    if (col.key === 'main_category') return 'FITTING';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'uses_variant') return 'true';
    if (col.key === 'variant_name') return 'Green';
    if (col.key === 'variant_sale_price') return '150.00';
    if (col.key === 'variant_purchase_price') return '120.00';
    return '';
  });
  const sampleRow3 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'uses_variant') return 'true';
    if (col.key === 'variant_name') return 'Blue';
    if (col.key === 'variant_sale_price') return '160.00';
    if (col.key === 'variant_purchase_price') return '130.00';
    return '';
  });
  
  return [headers.join(','), sampleRow1.join(','), sampleRow2.join(','), sampleRow3.join(',')].join('\n');
};

export const generateImportTemplateXLSX = (): ArrayBuffer => {
  const headers = IMPORT_COLUMNS.map(col => col.label);
  // Row 1: flat item
  const sampleRow1 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'ITEM-001';
    if (col.key === 'name') return 'Sample Item';
    if (col.key === 'main_category') return 'VALVE';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'sale_price') return 100.00;
    if (col.key === 'purchase_price') return 80.00;
    if (col.key === 'gst_rate') return 18;
    if (col.key === 'is_active') return 'Yes';
    if (col.key === 'uses_variant') return 'No';
    return '';
  });
  // Row 2: coupling Green
  const sampleRow2 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'name') return 'Coupling 32mm';
    if (col.key === 'main_category') return 'FITTING';
    if (col.key === 'unit') return 'nos';
    if (col.key === 'gst_rate') return 18;
    if (col.key === 'is_active') return 'Yes';
    if (col.key === 'uses_variant') return 'Yes';
    if (col.key === 'variant_name') return 'Green';
    if (col.key === 'variant_sale_price') return 150.00;
    if (col.key === 'variant_purchase_price') return 120.00;
    return '';
  });
  // Row 3: coupling Blue (repeat item_code, different variant)
  const sampleRow3 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'COUP-32MM';
    if (col.key === 'name') return 'Coupling 32mm';
    if (col.key === 'uses_variant') return 'Yes';
    if (col.key === 'variant_name') return 'Blue';
    if (col.key === 'variant_sale_price') return 160.00;
    if (col.key === 'variant_purchase_price') return 130.00;
    return '';
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2, sampleRow3]);
  // Column widths
  ws['!cols'] = IMPORT_COLUMNS.map(col =>
    ['variant_name','variant_make','variant_sale_price','variant_purchase_price','uses_variant'].includes(col.key)
      ? { wch: 20 }
      : { wch: 16 }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items Template');
  // Add Notes sheet
  const notesData = [
    ['Column', 'Notes'],
    ['Item Code', 'Required. Unique identifier. For variant items: repeat Item Code on each variant row.'],
    ['Item Name', 'Required on first row of each item. Can be blank on subsequent variant rows.'],
    ['Uses Variant', 'Yes / No. If Yes, fill Variant Name, Variant Sale Price, Variant Purchase Price.'],
    ['Variant Name', 'e.g. Green, Blue, Retail, Wholesale. One variant per row.'],
    ['Variant Make/Brand', 'Optional brand per variant row.'],
    ['Variant Sale Price', 'Sale price for this specific variant.'],
    ['Variant Purchase Price', 'Purchase price for this specific variant.'],
    ['Sale Price', 'Default sale price (used when Uses Variant = No).'],
    ['Purchase Price', 'Default purchase price (used when Uses Variant = No).'],
    ['Warehouse', 'Name of warehouse for Current Stock column.'],
  ];
  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 26 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
};

// Generate XLSX export from existing items including variant pricing rows
export const generateExportXLSX = async (materials: any[]): Promise<ArrayBuffer> => {
  // Fetch all variant pricing for these items in one query
  const itemIds = materials.filter(m => m.uses_variant).map(m => m.id);
  let variantPricingMap: Record<string, any[]> = {};
  if (itemIds.length > 0) {
    try {
      const { data } = await supabase
        .from('item_variant_pricing')
        .select('*, company_variants(variant_name)')
        .in('item_id', itemIds);
      (data || []).forEach(row => {
        if (!variantPricingMap[row.item_id]) variantPricingMap[row.item_id] = [];
        variantPricingMap[row.item_id].push(row);
      });
    } catch { /* ignore */ }
  }

  const headers = IMPORT_COLUMNS.map(col => col.label);
  const dataRows: any[][] = [];

  for (const item of materials) {
    const baseRow = (col: typeof IMPORT_COLUMNS[0]) => {
      const v = item[col.key];
      if (col.key === 'is_active') return item.is_active !== false ? 'Yes' : 'No';
      if (col.key === 'uses_variant') return item.uses_variant ? 'Yes' : 'No';
      if (['variant_name','variant_make','variant_sale_price','variant_purchase_price'].includes(col.key)) return '';
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return v;
    };

    if (item.uses_variant) {
      const pricingRows = variantPricingMap[item.id] || [];
      if (pricingRows.length === 0) {
        // No pricing rows yet – export one skeleton row
        dataRows.push(IMPORT_COLUMNS.map(col => {
          if (col.key === 'uses_variant') return 'Yes';
          if (col.key === 'variant_name') return '';
          if (['variant_make','variant_sale_price','variant_purchase_price'].includes(col.key)) return '';
          return baseRow(col);
        }));
      } else {
        pricingRows.forEach((pr, idx) => {
          dataRows.push(IMPORT_COLUMNS.map(col => {
            if (idx > 0 && !['item_code','uses_variant','variant_name','variant_make','variant_sale_price','variant_purchase_price'].includes(col.key)) return '';
            if (col.key === 'uses_variant') return 'Yes';
            if (col.key === 'variant_name') return pr.company_variants?.variant_name || '';
            if (col.key === 'variant_make') return pr.make || '';
            if (col.key === 'variant_sale_price') return pr.sale_price ?? '';
            if (col.key === 'variant_purchase_price') return pr.purchase_price ?? '';
            return baseRow(col);
          }));
        });
      }
    } else {
      dataRows.push(IMPORT_COLUMNS.map(col => baseRow(col)));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = IMPORT_COLUMNS.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items Export');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
};

export const parseExcelData = async (
  text: string,
  existingItems: any[],
  warehouses: any[]
): Promise<ImportValidationResult> => {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { validRows: [], errorRows: [], summary: { total: 0, toCreate: 0, toUpdate: 0, errors: 0, warnings: 0 } };
  }
  
  // Parse headers
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const rawHeaders = firstLine.split(delimiter).map(h => h.trim());
  
  // Map headers to column keys
  const headerMapping: Record<number, string> = {};
  const unmappedHeaders: string[] = [];
  
  rawHeaders.forEach((header, index) => {
    const mappedKey = mapColumnHeader(header);
    if (mappedKey) {
      headerMapping[index] = mappedKey;
    } else {
      unmappedHeaders.push(header);
    }
  });
  
  // Check required columns
  const missingRequired = REQUIRED_COLUMNS.filter(req => !Object.values(headerMapping).includes(req));
  if (missingRequired.length > 0) {
    throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
  }
  
  // Build lookup maps
  const itemByCode: Record<string, any> = {};
  const itemByName: Record<string, any> = {};
  existingItems.forEach(item => {
    if (item.item_code) itemByCode[item.item_code.toLowerCase().trim()] = item;
    if (item.name) itemByName[item.name.toLowerCase().trim()] = item;
    if (item.display_name) itemByName[item.display_name.toLowerCase().trim()] = item;
  });
  
  const warehouseMap: Record<string, any> = {};
  warehouses.forEach(wh => {
    const name = wh.warehouse_name || wh.name;
    if (name) warehouseMap[name.toLowerCase().trim()] = wh;
  });
  
  // Parse data rows
  const validRows: BulkImportRow[] = [];
  const errorRows: BulkImportRow[] = [];
  let toCreate = 0;
  let toUpdate = 0;
  let warningCount = 0;
  
  const startRow = 1; // Skip header
  
  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(delimiter).map(c => c.trim());
    const rowNo = i + 1;
    
    const row: BulkImportRow = {
      rowNo,
      action: 'skip',
      identifier: '',
      data: {},
      errors: [],
      warnings: [],
    };
    
    // Extract data based on column mapping
    const rowData: Record<string, any> = {};
    Object.entries(headerMapping).forEach(([colIndex, key]) => {
      const value = cols[parseInt(colIndex)];
      if (value !== undefined && value !== '') {
        rowData[key] = value;
      }
    });
    
    // Validate required fields
    if (!rowData.item_code && !rowData.name) {
      row.errors.push('Either Item Code or Name is required');
    }
    
    // Check if item exists
    const codeKey = rowData.item_code?.toLowerCase().trim();
    const nameKey = rowData.name?.toLowerCase().trim();
    
    const existingItem = codeKey ? itemByCode[codeKey] : (nameKey ? itemByName[nameKey] : undefined);
    
    if (existingItem) {
      row.action = 'update';
      row.item = existingItem;
      row.identifier = existingItem.item_code || existingItem.name;
      toUpdate++;
    } else {
      row.action = 'create';
      row.identifier = rowData.item_code || rowData.name || `Row ${rowNo}`;
      toCreate++;
    }
    
    // Validate and transform data
    const columnDef = IMPORT_COLUMNS.find(col => col.key === 'sale_price');
    
    // Validate numeric fields
    ['sale_price', 'purchase_price', 'gst_rate', 'weight', 'low_stock_level', 'current_stock',
     'variant_sale_price', 'variant_purchase_price'].forEach(field => {
      if (rowData[field] !== undefined) {
        const num = validateNumeric(rowData[field]);
        if (num !== null) {
          rowData[field] = num;
        } else if (rowData[field]) {
          row.warnings.push(`Invalid ${field}: "${rowData[field]}"`);
          warningCount++;
          delete rowData[field];
        }
      }
    });
    
    // Validate boolean fields
    if (rowData.is_active !== undefined) {
      rowData.is_active = validateBoolean(rowData.is_active);
    }
    if (rowData.uses_variant !== undefined) {
      rowData.uses_variant = validateBoolean(rowData.uses_variant);
    }
    
    // Validate dropdown fields
    const taxableCol = IMPORT_COLUMNS.find(col => col.key === 'taxable');
    if (rowData.taxable && taxableCol?.options) {
      const valid = validateDropdown(rowData.taxable, taxableCol.options);
      if (valid) {
        rowData.taxable = valid;
      } else {
        row.warnings.push(`Invalid taxable value: "${rowData.taxable}". Use: taxable, non-taxable, non-gst supply`);
        warningCount++;
        delete rowData.taxable;
      }
    }
    
    const invAccountCol = IMPORT_COLUMNS.find(col => col.key === 'inventory_account');
    if (rowData.inventory_account && invAccountCol?.options) {
      const valid = validateDropdown(rowData.inventory_account, invAccountCol.options);
      if (valid) {
        rowData.inventory_account = valid;
      } else {
        row.warnings.push(`Invalid inventory_account: "${rowData.inventory_account}". Use: finished goods, inventory asset, work in progress`);
        warningCount++;
        delete rowData.inventory_account;
      }
    }
    
    // Validate HSN code (numeric, max 10 digits)
    if (rowData.hsn_code && !/^\d{1,10}$/.test(rowData.hsn_code)) {
      row.warnings.push(`HSN code should be numeric (max 10 digits): "${rowData.hsn_code}"`);
      warningCount++;
    }
    
    // Check warehouse if stock is provided
    if (rowData.current_stock !== undefined && rowData.current_stock !== null) {
      if (rowData.warehouse) {
        const whKey = rowData.warehouse.toLowerCase().trim();
        if (!warehouseMap[whKey]) {
          row.warnings.push(`Warehouse "${rowData.warehouse}" not found. Stock will not be updated.`);
          warningCount++;
          delete rowData.current_stock;
          delete rowData.warehouse;
        } else {
          rowData.warehouse_id = warehouseMap[whKey].id;
        }
      } else {
        // Use default warehouse
        const defaultWh = warehouses.find(w => w.is_default) || warehouses[0];
        if (defaultWh) {
          rowData.warehouse_id = defaultWh.id;
        }
      }
    }
    
    row.data = rowData;
    
    if (row.errors.length > 0) {
      errorRows.push(row);
    } else {
      validRows.push(row);
    }
  }
  
  return {
    validRows,
    errorRows,
    summary: {
      total: lines.length - 1,
      toCreate,
      toUpdate,
      errors: errorRows.length,
      warnings: warningCount,
    },
  };
};

export const applyBulkImport = async (
  rows: BulkImportRow[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const result = { success: 0, failed: 0, errors: [] as string[] };
  const nowIso = new Date().toISOString();
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i + 1, rows.length);
    
    try {
      const { data: rowData, item: existingItem, action } = row;
      
      // Prepare data for database
      const dbData: any = {
        updated_at: nowIso,
        item_type: 'product',
      };
      
      // Map fields
      if (rowData.name) dbData.name = rowData.name;
      if (rowData.display_name) dbData.display_name = rowData.display_name;
      if (rowData.item_code) dbData.item_code = rowData.item_code;
      if (rowData.main_category) dbData.main_category = rowData.main_category;
      if (rowData.sub_category) dbData.sub_category = rowData.sub_category;
      if (rowData.size) dbData.size = rowData.size;
      if (rowData.size_lwh) dbData.size_lwh = rowData.size_lwh;
      if (rowData.pressure_class) dbData.pressure_class = rowData.pressure_class;
      if (rowData.make) dbData.make = rowData.make;
      if (rowData.material) dbData.material = rowData.material;
      if (rowData.end_connection) dbData.end_connection = rowData.end_connection;
      if (rowData.unit) dbData.unit = rowData.unit;
      if (rowData.sale_price !== undefined) dbData.sale_price = rowData.sale_price;
      if (rowData.purchase_price !== undefined) dbData.purchase_price = rowData.purchase_price;
      if (rowData.hsn_code) dbData.hsn_code = rowData.hsn_code;
      if (rowData.gst_rate !== undefined) dbData.gst_rate = rowData.gst_rate;
      if (rowData.part_number) dbData.part_number = rowData.part_number;
      if (rowData.taxable) dbData.taxable = rowData.taxable;
      if (rowData.weight !== undefined) dbData.weight = rowData.weight;
      if (rowData.upc) dbData.upc = rowData.upc;
      if (rowData.mpn) dbData.mpn = rowData.mpn;
      if (rowData.ean) dbData.ean = rowData.ean;
      if (rowData.inventory_account) dbData.inventory_account = rowData.inventory_account;
      if (rowData.is_active !== undefined) dbData.is_active = rowData.is_active;
      if (rowData.low_stock_level !== undefined) dbData.low_stock_level = rowData.low_stock_level;
      if (rowData.uses_variant !== undefined) dbData.uses_variant = rowData.uses_variant;
      
      let itemId: string;
      
      if (action === 'update' && existingItem) {
        // Update existing item
        const { error } = await supabase
          .from('materials')
          .update(dbData)
          .eq('id', existingItem.id);
        
        if (error) throw error;
        itemId = existingItem.id;
      } else {
        // Create new item
        const { data, error } = await supabase
          .from('materials')
          .insert(dbData)
          .select()
          .single();
        
        if (error) throw error;
        itemId = data.id;
      }
      
      // Update stock if provided
      if (rowData.current_stock !== undefined && rowData.warehouse_id) {
        try {
          const { data: existingStock } = await supabase
            .from('item_stock')
            .select('id')
            .eq('item_id', itemId)
            .eq('warehouse_id', rowData.warehouse_id)
            .maybeSingle();
          
          if (existingStock) {
            await supabase
              .from('item_stock')
              .update({ current_stock: rowData.current_stock, updated_at: nowIso })
              .eq('id', existingStock.id);
          } else {
            await supabase
              .from('item_stock')
              .insert({
                item_id: itemId,
                warehouse_id: rowData.warehouse_id,
                current_stock: rowData.current_stock,
                created_at: nowIso,
                updated_at: nowIso,
              });
          }
        } catch (stockError) {
          console.warn('Stock update failed for row', row.rowNo, stockError);
        }
      }

      // Update variant pricing if provided
      if (rowData.variant_name && rowData.variant_name.trim()) {
        try {
          // Resolve company_variant_id by name
          const { data: variantData } = await supabase
            .from('company_variants')
            .select('id')
            .ilike('variant_name', rowData.variant_name.trim())
            .maybeSingle();

          if (variantData?.id) {
            const pricingPayload: any = {
              item_id: itemId,
              company_variant_id: variantData.id,
              updated_at: nowIso,
            };
            if (rowData.variant_sale_price !== undefined) pricingPayload.sale_price = rowData.variant_sale_price;
            if (rowData.variant_purchase_price !== undefined) pricingPayload.purchase_price = rowData.variant_purchase_price;
            if (rowData.variant_make) pricingPayload.make = rowData.variant_make;

            // Upsert by (item_id, company_variant_id)
            const { data: existingPricing } = await supabase
              .from('item_variant_pricing')
              .select('id')
              .eq('item_id', itemId)
              .eq('company_variant_id', variantData.id)
              .maybeSingle();

            if (existingPricing) {
              await supabase
                .from('item_variant_pricing')
                .update(pricingPayload)
                .eq('id', existingPricing.id);
            } else {
              await supabase
                .from('item_variant_pricing')
                .insert({ ...pricingPayload, created_at: nowIso });
            }
          } else {
            console.warn(`Variant "${rowData.variant_name}" not found in company_variants. Skipping pricing row.`);
          }
        } catch (variantError) {
          console.warn('Variant pricing update failed for row', row.rowNo, variantError);
        }
      }
      
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(`Row ${row.rowNo} (${row.identifier}): ${error.message}`);
    }
  }
  
  return result;
};

export { IMPORT_COLUMNS, COLUMN_ALIASES };
