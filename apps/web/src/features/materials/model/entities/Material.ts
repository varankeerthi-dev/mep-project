/** Domain entity for a material/item in the system. Mirrors the `materials` DB table. */
export interface Material {
  id: string;
  organisation_id: string;
  item_code: string;
  name: string;
  display_name: string | null;
  main_category: string | null;
  sub_category: string | null;
  size: string | null;
  pressure_class: string | null;
  make: string | null;
  material: string | null;
  end_connection: string | null;
  unit: string;
  sale_price: number | null;
  purchase_price: number | null;
  hsn_code: string | null;
  gst_rate: number | null;
  is_active: boolean;
  uses_variant: boolean;
  discount_category_id: string | null;
  dimension: string | null;
  dimension_unit: string;
  weight: number | null;
  weight_unit: string;
  item_type: string;
  item_classification: string;
  allow_purchase: boolean;
  allow_sales: boolean;
  show_in_bom: boolean;
  is_manufactured: boolean;
  created_at?: string;
  updated_at?: string;

  // Joined relations (optional, populated by queries)
  material_units?: MaterialUnit[];
  discount_category?: { id: string; name: string; default_discount_percent: number };
}

/** Alternative unit definition for a material */
export interface MaterialUnit {
  id: string;
  material_id: string;
  unit_name: string;
  conversion_factor: number;
}

/** Stock level for a material in a warehouse */
export interface ItemStock {
  id: string;
  item_id: string;
  warehouse_id: string;
  company_variant_id: string | null;
  current_stock: number;
  low_stock_level: number | null;
  updated_at: string;
}
