import { useState, useCallback } from 'react';
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
    return '';
  });
  
  const sampleRow2 = IMPORT_COLUMNS.map(col => {
    if (col.key === 'item_code') return 'ITEM-002';
    if (col.key === 'name') return 'Another Item';
    if (col.key === 'display_name') return 'Another Display';
    if (col.key === 'main_category') return 'PIPE';
    if (col.key === 'sub_category') return 'GI Pipe';
    if (col.key === 'size') return '2 inch';
    if (col.key === 'unit') return 'mtr';
    if (col.key === 'sale_price') return '250.00';
    if (col.key === 'purchase_price') return '200.00';
    if (col.key === 'gst_rate') return '18';
    if (col.key === 'part_number') return 'PN-12345';
    if (col.key === 'weight') return '5.5';
    if (col.key === 'is_active') return 'Yes';
    return '';
  });
  
  return [headers.join('\t'), sampleRow1.join('\t'), sampleRow2.join('\t')].join('\n');
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
    return '';
  });
  
  return [headers.join(','), sampleRow1.join(',')].join('\n');
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
    ['sale_price', 'purchase_price', 'gst_rate', 'weight', 'low_stock_level', 'current_stock'].forEach(field => {
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
          // Check if stock record exists
          const { data: existingStock } = await supabase
            .from('item_stock')
            .select('id')
            .eq('item_id', itemId)
            .eq('warehouse_id', rowData.warehouse_id)
            .maybeSingle();
          
          if (existingStock) {
            // Update existing stock
            await supabase
              .from('item_stock')
              .update({ current_stock: rowData.current_stock, updated_at: nowIso })
              .eq('id', existingStock.id);
          } else {
            // Create new stock record
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
      
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(`Row ${row.rowNo} (${row.identifier}): ${error.message}`);
    }
  }
  
  return result;
};

export { IMPORT_COLUMNS, COLUMN_ALIASES };
