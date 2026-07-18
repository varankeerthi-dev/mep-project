/**
 * MaterialEditor aggregate — editor-only types that represent the form state
 * and transient data used during create/edit/duplicate flows.
 * These are NOT persisted directly; they are mapped to/from Material entities.
 */
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
  allow_purchase: boolean;
  allow_sales: boolean;
  show_in_bom: boolean;
  is_manufactured: boolean;
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
    item_classification: 'goods_sold',
    allow_purchase: true,
    allow_sales: true,
    show_in_bom: true,
    is_manufactured: false,
  };
}

export interface ClassificationOption {
  value: string;
  label: string;
  desc: string;
  requiresMfg: boolean;
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  { value: 'finished_good', label: 'Finished Good', desc: 'Manufactured and sold', requiresMfg: true },
  { value: 'raw_material', label: 'Raw Material', desc: 'Purchased, consumed in production, appears in BOM', requiresMfg: true },
  { value: 'consumable', label: 'Consumable', desc: 'Purchased, used for operations/maintenance, not in BOM', requiresMfg: false },
  { value: 'goods_sold', label: 'Goods Sold', desc: 'Purchased and resold as-is', requiresMfg: false },
];

export const CLASSIFICATION_PRESETS: Record<string, { allow_purchase: boolean; allow_sales: boolean; show_in_bom: boolean; is_manufactured: boolean }> = {
  finished_good: { allow_purchase: false, allow_sales: true, show_in_bom: false, is_manufactured: true },
  raw_material: { allow_purchase: true, allow_sales: false, show_in_bom: true, is_manufactured: false },
  consumable: { allow_purchase: true, allow_sales: false, show_in_bom: false, is_manufactured: false },
  goods_sold: { allow_purchase: true, allow_sales: true, show_in_bom: false, is_manufactured: false },
};
