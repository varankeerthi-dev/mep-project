export interface ProductionEntry {
  id?: string;
  entry_no: string;
  job_card_id: string;
  actual_qty: number;
  output_unit: string;
  notes?: string;
  production_start_time?: string;
  production_end_time?: string;
  operator_name?: string;
  machine_name?: string;
  scrap_byproducts?: string;
  organisation_id: string;
  created_by?: string;
  created_at?: string;
}

export interface ProductionEntryItem {
  id?: string;
  production_entry_id: string;
  job_card_material_id: string;
  material_id: string;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
}
