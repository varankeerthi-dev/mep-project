export interface BOMHeader {
  id?: string;
  bom_code: string;
  product_name: string;
  product_id: string;
  output_qty: number;
  output_unit: string;
  description?: string;
  is_active: boolean;
  batch_no?: string;
  approval_status: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
  custom_attributes?: Record<string, any>;
  total_estimated_cost?: number;
  estimated_production_minutes?: number;
  revision?: string;
  effective_date?: string;
  valid_to?: string;
  product_code?: string;
  bom_type?: string;
  priority?: string;
  product_category?: string;
  created_by_name?: string;
  approved_by_name?: string;
}

export interface BOMItem {
  id?: string;
  bom_id?: string;
  material_id: string;
  material_name?: string;
  required_qty: number;
  unit: string;
  wastage_pct: number;
  notes?: string;
  company_variant_id?: string;
  variant_name?: string;
  make?: string;
  lead_time_days: number;
  bom_level?: number;
  parent_material_id?: string | null;
  custom_attributes?: Record<string, any>;
  unit_cost?: number;
  sequence_no?: number;
  work_center_id?: string;
  is_critical?: boolean;
  alternate_material_id?: string;
  drawing_reference?: string;
  inspection_required?: boolean;
  shelf_life_days?: number;
  warehouse_id?: string;
  scrap_factor?: number;
  yield_pct?: number;
}

export interface BomWorkCenter {
  id?: string;
  bom_id: string;
  work_center_id: string;
  setup_time_minutes?: number;
  cycle_time_minutes: number;
  is_preferred: boolean;
  organisation_id: string;
  created_at?: string;
}
