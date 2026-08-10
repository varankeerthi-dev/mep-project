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
