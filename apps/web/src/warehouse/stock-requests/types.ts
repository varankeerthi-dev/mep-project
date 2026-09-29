// src/warehouse/stock-requests/types.ts
// TypeScript domain types for the Warehouse Stock Request & Fulfillment module.
// Mirrors the stock request database schema.

// ─── Status enums ───────────────────────────────────────────────────────────

export type StockRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_process'
  | 'partially_allocated'
  | 'allocated'
  | 'awaiting_dispatch'
  | 'partially_dispatched'
  | 'in_transit'
  | 'partially_received'
  | 'fulfilled'
  | 'cancelled'
  | 'closed';

export type StockRequestPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type AllocationStatus =
  | 'confirmed'
  | 'partially_dispatched'
  | 'dispatched'
  | 'partially_received'
  | 'received'
  | 'released'
  | 'cancelled';

export type ActivityEventType =
  | 'created'
  | 'submitted'
  | 'acknowledged'
  | 'allocated'
  | 'released'
  | 'reallocated'
  | 'transfer_created'
  | 'dispatched'
  | 'received'
  | 'cancelled'
  | 'revised'
  | 'status_changed'
  | 'note_added';

// ─── Status display helpers ─────────────────────────────────────────────────

export const STATUS_LABELS: Record<StockRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_process: 'Under Process',
  partially_allocated: 'Partially Allocated',
  allocated: 'Allocated',
  awaiting_dispatch: 'Awaiting Dispatch',
  partially_dispatched: 'Partially Dispatched',
  in_transit: 'In Transit',
  partially_received: 'Partially Received',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<StockRequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_process: 'bg-amber-100 text-amber-700',
  partially_allocated: 'bg-orange-100 text-orange-700',
  allocated: 'bg-emerald-100 text-emerald-700',
  awaiting_dispatch: 'bg-cyan-100 text-cyan-700',
  partially_dispatched: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-purple-100 text-purple-700',
  partially_received: 'bg-teal-100 text-teal-700',
  fulfilled: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  closed: 'bg-slate-100 text-slate-700',
};

export const PRIORITY_LABELS: Record<StockRequestPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
};

export const PRIORITY_COLORS: Record<StockRequestPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

// ─── DB row types ───────────────────────────────────────────────────────────

export interface StockRequestRow {
  id: string;
  organisation_id: string;
  request_number: string;
  destination_warehouse_id: string;
  requested_by: string;
  requested_at: string;
  required_date: string | null;
  priority: StockRequestPriority;
  status: StockRequestStatus;
  revision_number: number;
  remarks: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  // Joined fields
  destination_warehouse?: {
    id: string;
    name: string;
    warehouse_code: string | null;
    warehouse_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  requester?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  lines?: StockRequestLineRow[];
}

export interface StockRequestLineRow {
  id: string;
  organisation_id: string;
  request_id: string;
  item_id: string;
  company_variant_id: string | null;
  requested_qty: number;
  allocated_qty: number;
  dispatched_qty: number;
  received_qty: number;
  notes: string | null;
  line_number: number;
  created_at: string;
  updated_at: string;
  // Computed
  open_qty?: number;
  // Joined fields
  item?: {
    id: string;
    name: string;
    item_code: string | null;
    unit: string | null;
  };
  variant?: {
    id: string;
    variant_name: string | null;
  };
  allocations?: StockRequestAllocationRow[];
}

export interface StockRequestAllocationRow {
  id: string;
  organisation_id: string;
  request_line_id: string;
  request_id: string;
  source_warehouse_id: string;
  item_id: string;
  company_variant_id: string | null;
  allocated_qty: number;
  dispatched_qty: number;
  received_qty: number;
  released_qty: number;
  status: AllocationStatus;
  allocated_by: string;
  allocated_at: string;
  transfer_id: string | null;
  notes: string | null;
  reason: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  source_warehouse?: {
    id: string;
    name: string;
    warehouse_code: string | null;
    warehouse_name: string | null;
  };
  allocator?: {
    id: string;
    full_name: string | null;
  };
  transfer?: {
    id: string;
    transfer_no: string;
    status: string;
  };
}

export interface StockRequestActivityRow {
  id: string;
  organisation_id: string;
  request_id: string;
  request_line_id: string | null;
  allocation_id: string | null;
  event_type: ActivityEventType;
  actor_id: string;
  actor_name: string | null;
  source_warehouse_id: string | null;
  destination_warehouse_id: string | null;
  item_id: string | null;
  company_variant_id: string | null;
  quantity: number | null;
  before_status: string | null;
  after_status: string | null;
  before_qty: number | null;
  after_qty: number | null;
  reference_type: string | null;
  reference_id: string | null;
  remarks: string | null;
  metadata: Record<string, unknown>;
  idempotency_key: string | null;
  created_at: string;
  // Joined
  actor?: {
    id: string;
    full_name: string | null;
  };
}

// ─── Stock availability ─────────────────────────────────────────────────────

export interface StockAvailability {
  item_id: string;
  company_variant_id: string | null;
  warehouse_id: string;
  on_hand: number;
  so_committed: number;
  sr_committed: number;
  total_committed: number;
  available_to_commit: number;
}

// ─── Form/input types ───────────────────────────────────────────────────────

export interface CreateStockRequestInput {
  destination_warehouse_id: string;
  required_date?: string;
  priority: StockRequestPriority;
  remarks?: string;
  lines: CreateStockRequestLineInput[];
}

export interface CreateStockRequestLineInput {
  item_id: string;
  company_variant_id?: string;
  requested_qty: number;
  notes?: string;
}

export interface AllocateStockRequestInput {
  request_line_id: string;
  source_warehouse_id: string;
  item_id: string;
  company_variant_id?: string;
  allocated_qty: number;
  notes?: string;
}

export interface ReleaseAllocationInput {
  allocation_id: string;
  release_qty: number;
  reason: string;
}

// ─── Filter types ───────────────────────────────────────────────────────────

export interface StockRequestFilters {
  status?: StockRequestStatus | StockRequestStatus[];
  priority?: StockRequestPriority;
  destination_warehouse_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

// ─── Traceability view ──────────────────────────────────────────────────────

export interface RequestTraceability {
  request: StockRequestRow;
  lines: (StockRequestLineRow & {
    allocations: (StockRequestAllocationRow & {
      transfer?: {
        id: string;
        transfer_no: string;
        status: string;
        dispatched_at: string | null;
        received_at: string | null;
      };
    })[];
  })[];
}
