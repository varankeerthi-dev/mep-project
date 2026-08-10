export interface JobCard {
  id?: string;
  job_card_no: string;
  bom_id: string;
  planned_qty: number;
  actual_qty?: number;
  status: string; // 'draft' | 'issued' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent';
  remarks?: string;
  organisation_id: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  output_unit: string;
}

export interface JobCardMaterial {
  id?: string;
  job_card_id: string;
  material_id: string;
  planned_qty: number;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
  status: string; // 'reserved' | 'issued' | 'consumed' | 'returned'
  warehouse_id?: string | null;
  materials?: {
    name: string;
    unit: string;
  } | null;
}
