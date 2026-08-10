export interface Warehouse {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string; // 'main' | 'wip' | 'fg' | 'general'
  is_default: boolean;
  is_active: boolean;
}

export interface ItemStock {
  id?: string;
  item_id: string;
  warehouse_id: string;
  company_variant_id?: string | null;
  current_stock: number;
  organisation_id: string;
  updated_at?: string;
}

export interface MaterialRequisition {
  id?: string;
  requisition_no: string;
  job_card_id?: string | null;
  requested_by?: string | null;
  requested_date: string;
  required_date?: string;
  status: 'draft' | 'submitted' | 'approved' | 'partially_issued' | 'issued' | 'rejected';
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialRequisitionItem {
  id?: string;
  requisition_id: string;
  material_id: string;
  required_qty: number;
  issued_qty: number;
  unit: string;
  stock_available?: number;
  warehouse_id?: string | null;
  status: 'pending' | 'issued' | 'short_supplied';
  organisation_id: string;
  created_at?: string;
}

export interface GoodsReceiptNote {
  id?: string;
  grn_no: string;
  purchase_order_id?: string | null;
  vendor_name: string;
  invoice_number?: string;
  invoice_date?: string;
  receipt_date: string;
  received_by?: string | null;
  status: 'draft' | 'qc_pending' | 'qc_passed' | 'qc_failed' | 'accepted' | 'rejected';
  vehicle_number?: string;
  challan_number?: string;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface GRNItem {
  id?: string;
  grn_id: string;
  purchase_order_item_id?: string | null;
  material_id: string;
  ordered_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  unit: string;
  batch_no?: string;
  expiry_date?: string;
  warehouse_id?: string | null;
  status: 'pending' | 'qc_passed' | 'qc_failed' | 'accepted';
  organisation_id: string;
  created_at?: string;
}

export interface ActivityLog {
  id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  action_details: Record<string, any>;
  user_id: string;
  user_name: string;
  organisation_id: string;
  created_at?: string;
}
