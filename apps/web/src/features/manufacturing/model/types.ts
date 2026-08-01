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
}

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

export interface DispatchOrder {
  id?: string;
  dispatch_no: string;
  sales_order_id?: string | null;
  customer_name: string;
  customer_address?: string;
  planned_dispatch_date?: string;
  actual_dispatch_date?: string;
  status: 'draft' | 'picking' | 'packed' | 'verified' | 'dispatched' | 'cancelled';
  transport_mode?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  freight_charges: number;
  tracking_number?: string;
  estimated_delivery_date?: string;
  remarks?: string;
  created_by?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DispatchItem {
  id?: string;
  dispatch_order_id: string;
  sales_order_item_id?: string | null;
  material_id: string;
  ordered_qty: number;
  picked_qty: number;
  packed_qty: number;
  dispatched_qty: number;
  unit: string;
  batch_no?: string;
  warehouse_id?: string | null;
  status: 'pending' | 'picking' | 'packed' | 'dispatched';
  organisation_id: string;
  created_at?: string;
}

export interface DispatchPacking {
  id?: string;
  dispatch_order_id: string;
  carton_number: number;
  carton_type?: string;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  gross_weight_kg?: number;
  net_weight_kg?: number;
  contents: Array<{
    material_id: string;
    qty: number;
    batch_no?: string;
  }>;
  handling_instructions?: string;
  organisation_id: string;
  created_at?: string;
}

export interface DispatchCountVerification {
  id?: string;
  dispatch_order_id: string;
  verified_by?: string;
  verified_at?: string;
  material_id: string;
  system_qty: number;
  counted_qty: number;
  variance_qty?: number;
  variance_reason?: string;
  status: 'pending' | 'matched' | 'discrepancy' | 'resolved';
  organisation_id: string;
  created_at?: string;
}

export interface QCParameter {
  id?: string;
  bom_id?: string | null;
  product_id?: string | null;
  parameter_name: string;
  specification: string;
  measurement_unit?: string;
  test_method?: string;
  aql_level: string;
  severity: 'critical' | 'major' | 'minor';
  is_active: boolean;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface FGQCInspection {
  id?: string;
  inspection_no: string;
  production_entry_id?: string | null;
  job_card_id?: string | null;
  product_id: string;
  batch_no: string;
  produced_qty: number;
  sample_size?: number;
  accepted_qty: number;
  rejected_qty: number;
  rework_qty: number;
  inspection_date: string;
  inspector_id?: string | null;
  inspection_result: 'pending' | 'accepted' | 'partially_accepted' | 'rejected';
  defect_categories?: Array<{ category: string; count: number; severity: string }>;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface QCParameterResult {
  id?: string;
  inspection_id: string;
  parameter_id: string;
  measured_value?: string;
  is_pass: boolean;
  remarks?: string;
  created_at?: string;
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

export interface RMQCInspection {
  id?: string;
  grn_id: string;
  inspection_no: string;
  inspector_id?: string | null;
  inspection_date: string;
  result: 'pending' | 'passed' | 'failed' | 'conditional';
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorkCenter {
  id?: string;
  name: string;
  code: string;
  work_center_type: 'machine' | 'assembly_line' | 'workstation';
  capacity_per_hour: number;
  capacity_uom: string;
  hours_per_shift: number;
  shifts_per_day: number;
  is_active: boolean;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
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

export interface ProductionPlan {
  id?: string;
  plan_no: string;
  plan_period_start: string;
  plan_period_end: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  remarks?: string;
  created_by?: string | null;
  organisation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductionPlanItem {
  id?: string;
  plan_id: string;
  product_id: string;
  product_name: string;
  bom_id?: string | null;
  demand_qty: number;
  current_fg_stock: number;
  wip_qty: number;
  net_to_produce: number;
  planned_qty: number;
  linked_sales_orders?: Array<{ order_id: string; order_no: string; qty: number; due_date: string }>;
  linked_schedule_id?: string | null;
  linked_job_card_ids?: string[];
  status: 'pending' | 'scheduled' | 'in_production' | 'fulfilled';
  organisation_id: string;
  created_at?: string;
}

export interface IPQCCheckpoint {
  id?: string;
  bom_id: string;
  sequence: number;
  checkpoint_name: string;
  checkpoint_type: 'mandatory' | 'optional';
  parameter_definitions: Array<{ name: string; spec: string; unit?: string; severity?: string }>;
  organisation_id: string;
  created_at?: string;
}

export interface IPQCInspection {
  id?: string;
  job_card_id: string;
  checkpoint_id: string;
  inspector_id?: string | null;
  inspection_date?: string;
  result: 'pending' | 'passed' | 'failed' | 'conditional';
  parameter_results: Array<{ name: string; measured_value?: string; is_pass: boolean }>;
  sampled_qty?: number;
  total_batch_qty?: number;
  remarks?: string;
  organisation_id: string;
  created_at?: string;
}

export interface WIPValuationSnapshot {
  id?: string;
  snapshot_date: string;
  job_card_id: string;
  material_id: string;
  wip_qty: number;
  unit_cost?: number;
  total_value?: number;
  days_in_wip?: number;
  organisation_id: string;
  created_at?: string;
}
