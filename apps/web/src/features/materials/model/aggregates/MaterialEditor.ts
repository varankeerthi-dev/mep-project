/**
 * MaterialEditor aggregate — editor-only types that represent the form state
 * and transient data used during create/edit/duplicate flows.
 * These are NOT persisted directly; they are mapped to/from Material entities.
 */
import type { MaterialCustomAttribute } from '../entities/Material';
export interface MaterialEditorFormData {
  item_code: string;
  item_name: string;
  display_name: string;
  main_category: string;
  sub_category: string;
  size: string;
  pressure_class: string;
  make: string;
  material: string;
  end_connection: string;
  unit: string;
  has_alternative_unit: boolean;
  alternative_units: { unit_name: string; conversion_factor: string }[];
  sale_price: string;
  purchase_price: string;
  hsn_code: string;
  gst_rate: number;
  is_active: boolean;
  uses_variant: boolean;
  track_inventory: boolean;
  discount_category_id: string | null;
  dimension: string;
  dimension_unit: string;
  weight: string;
  weight_unit: string;
  item_classification: string;
  accounting_treatment: string;
  gl_classification: string;
  is_stockable: boolean;
  is_depreciable: boolean;
  useful_life_years: string;
  asset_category_id: string | null;
  fixed_asset_account_id: string | null;
  sales_income_account_id: string | null;
  purchase_account_id: string | null;
  allow_purchase: boolean;
  allow_sales: boolean;
  show_in_bom: boolean;
  is_manufactured: boolean;
  custom_attributes: MaterialCustomAttribute[];
  has_warranty: boolean;
  warranty_period: string;
  warranty_unit: 'months' | 'years';
  has_serial_number: boolean;
  serial_number_format: string;
}

export function createDefaultFormData(): MaterialEditorFormData {
  return {
    item_code: '',
    item_name: '',
    display_name: '',
    main_category: '',
    sub_category: '',
    size: '',
    pressure_class: '',
    make: '',
    material: '',
    end_connection: '',
    unit: 'nos',
    has_alternative_unit: false,
    alternative_units: [],
    sale_price: '',
    purchase_price: '',
    hsn_code: '',
    gst_rate: 18,
    is_active: true,
    uses_variant: false,
    track_inventory: false,
    discount_category_id: null,
    dimension: '',
    dimension_unit: 'cm',
    weight: '',
    weight_unit: 'kg',
    item_classification: 'STOCK_IN_TRADE',
    accounting_treatment: 'INVENTORY_STOCK',
    gl_classification: 'INVENTORY_ASSET',
    is_stockable: true,
    is_depreciable: false,
    useful_life_years: '',
    asset_category_id: null,
    fixed_asset_account_id: null,
    sales_income_account_id: null,
    purchase_account_id: null,
    allow_purchase: true,
    allow_sales: true,
    show_in_bom: true,
    is_manufactured: false,
    custom_attributes: [],
    has_warranty: false,
    warranty_period: '',
    warranty_unit: 'months',
    has_serial_number: false,
    serial_number_format: '',
  };
}

export interface ClassificationOption {
  value: string;
  label: string;
  desc: string;
  requiresMfg: boolean;
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  { value: 'FINISHED_GOOD', label: 'Finished Good', desc: 'Manufactured and sold', requiresMfg: true },
  { value: 'RAW_MATERIAL', label: 'Raw Material', desc: 'Purchased, consumed in production, appears in BOM', requiresMfg: true },
  { value: 'CONSUMABLE', label: 'Consumable', desc: 'Purchased, used for operations/maintenance, not in BOM', requiresMfg: false },
  { value: 'STOCK_IN_TRADE', label: 'Stock-in-Trade', desc: 'Purchased and resold as-is', requiresMfg: false },
];

export const CLASSIFICATION_PRESETS: Record<string, { allow_purchase: boolean; allow_sales: boolean; show_in_bom: boolean; is_manufactured: boolean }> = {
  STOCK_IN_TRADE: { allow_purchase: true, allow_sales: true, show_in_bom: false, is_manufactured: false },
  RAW_MATERIAL: { allow_purchase: true, allow_sales: false, show_in_bom: true, is_manufactured: false },
  CONSUMABLE: { allow_purchase: true, allow_sales: false, show_in_bom: false, is_manufactured: false },
  FINISHED_GOOD: { allow_purchase: false, allow_sales: true, show_in_bom: false, is_manufactured: true },
  TOOL: { allow_purchase: true, allow_sales: false, show_in_bom: false, is_manufactured: false },
  SERVICE: { allow_purchase: true, allow_sales: true, show_in_bom: false, is_manufactured: false },
  // Backwards compatibility with legacy lowercase
  goods_sold: { allow_purchase: true, allow_sales: true, show_in_bom: false, is_manufactured: false },
  raw_material: { allow_purchase: true, allow_sales: false, show_in_bom: true, is_manufactured: false },
  consumable: { allow_purchase: true, allow_sales: false, show_in_bom: false, is_manufactured: false },
  finished_good: { allow_purchase: false, allow_sales: true, show_in_bom: false, is_manufactured: true },
};

export interface AccountingTreatmentOption {
  value: string;
  label: string;
  desc: string;
  gl_classification: 'INVENTORY_ASSET' | 'FIXED_ASSET' | 'EXPENSE';
  item_classification: string;
  is_stockable: boolean;
  is_depreciable: boolean;
}

export const ACCOUNTING_TREATMENT_OPTIONS: AccountingTreatmentOption[] = [
  {
    value: 'INVENTORY_STOCK',
    label: 'Inventory: Stock-in-Trade',
    desc: 'Purchased for resale or trading. Tracked in stock. Dr Inventory on purchase, Dr COGS / Cr Inventory on sale.',
    gl_classification: 'INVENTORY_ASSET',
    item_classification: 'STOCK_IN_TRADE',
    is_stockable: true,
    is_depreciable: false,
  },
  {
    value: 'INVENTORY_RAW',
    label: 'Inventory: Raw Material',
    desc: 'Purchased for production or fabrication. Tracked in stock. Consumed in BOM.',
    gl_classification: 'INVENTORY_ASSET',
    item_classification: 'RAW_MATERIAL',
    is_stockable: true,
    is_depreciable: false,
  },
  {
    value: 'INVENTORY_FINISHED',
    label: 'Inventory: Finished Good',
    desc: 'Manufactured item produced in-house. Tracked in stock. Sold to clients.',
    gl_classification: 'INVENTORY_ASSET',
    item_classification: 'FINISHED_GOOD',
    is_stockable: true,
    is_depreciable: false,
  },
  {
    value: 'FIXED_ASSET',
    label: 'Fixed Asset (Capital Expenditure)',
    desc: 'Capital equipment, machinery, tools, or vehicles. Auto-registers in Fixed Asset Register upon purchase bill.',
    gl_classification: 'FIXED_ASSET',
    item_classification: 'TOOL',
    is_stockable: false,
    is_depreciable: true,
  },
  {
    value: 'EXPENSE_CONSUMABLE',
    label: 'Expense: Consumables & Supplies',
    desc: 'Direct or operational supplies (welding rods, grease, small bits). Expensed immediately on purchase bill.',
    gl_classification: 'EXPENSE',
    item_classification: 'CONSUMABLE',
    is_stockable: false,
    is_depreciable: false,
  },
  {
    value: 'EXPENSE_SERVICE',
    label: 'Expense: Service & Subcontract',
    desc: 'Labor, services, or subcontracting charges. Expensed immediately, no inventory tracking.',
    gl_classification: 'EXPENSE',
    item_classification: 'SERVICE',
    is_stockable: false,
    is_depreciable: false,
  },
];

export function getAccountingTreatmentPreset(treatment: string) {
  const found = ACCOUNTING_TREATMENT_OPTIONS.find(o => o.value === treatment);
  if (!found) return null;
  return {
    gl_classification: found.gl_classification,
    item_classification: found.item_classification,
    is_stockable: found.is_stockable,
    is_depreciable: found.is_depreciable,
    allow_purchase: treatment !== 'INVENTORY_FINISHED',
    allow_sales: treatment === 'INVENTORY_STOCK' || treatment === 'INVENTORY_FINISHED' || treatment === 'EXPENSE_SERVICE',
    show_in_bom: treatment === 'INVENTORY_RAW',
    is_manufactured: treatment === 'INVENTORY_FINISHED',
  };
}

export function normalizeItemClassification(val?: string | null): string {
  if (!val || typeof val !== 'string') return 'STOCK_IN_TRADE';
  const upper = val.toUpperCase().trim();
  if (['GOODS_SOLD', 'STOCK-IN-TRADE', 'STOCK_IN_TRADE', 'TRADING'].includes(upper)) return 'STOCK_IN_TRADE';
  if (['FINISHED_GOOD', 'FINISHED_GOODS', 'FG'].includes(upper)) return 'FINISHED_GOOD';
  if (['RAW_MATERIAL', 'RAW_MATERIALS', 'RM'].includes(upper)) return 'RAW_MATERIAL';
  if (['CONSUMABLE', 'CONSUMABLES'].includes(upper)) return 'CONSUMABLE';
  if (['TOOL', 'TOOLS'].includes(upper)) return 'TOOL';
  if (['PLANT_MACHINERY', 'MACHINERY', 'PLANT'].includes(upper)) return 'PLANT_MACHINERY';
  if (['VEHICLE', 'VEHICLES'].includes(upper)) return 'VEHICLE';
  if (['SERVICE', 'SERVICES', 'LABOUR', 'LABOR'].includes(upper)) return 'SERVICE';
  if (upper === 'WIP') return 'WIP';
  if (upper === 'OTHER') return 'OTHER';
  return upper;
}
