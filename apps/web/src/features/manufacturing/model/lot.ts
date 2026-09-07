export interface InventoryLot {
  id: string;
  organisation_id: string;
  material_id: string;
  warehouse_id: string;
  batch_no: string;
  source_type: 'production' | 'purchase' | 'adjustment' | string;
  source_id?: string | null;
  production_entry_id?: string | null;
  qc_inspection_id?: string | null;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  quantity_received: number;
  quantity_available: number;
  status: 'available' | 'exhausted' | 'blocked' | string;
  created_at?: string;
  updated_at?: string;
}
