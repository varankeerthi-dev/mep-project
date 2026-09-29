// src/warehouse/stock-requests/stockRequestService.ts
// Data access layer for the Warehouse Stock Request & Fulfillment module.
// All queries are scoped by organisation_id (multi-tenant).
// Critical mutations use server-side RPCs for atomicity and concurrency safety.

import { supabase } from '../../supabase';
import type {
  StockRequestRow,
  StockRequestLineRow,
  StockRequestAllocationRow,
  StockRequestActivityRow,
  StockAvailability,
  CreateStockRequestInput,
  AllocateStockRequestInput,
  ReleaseAllocationInput,
  StockRequestFilters,
  StockRequestStatus,
} from './types';

// ─── Stock Request CRUD ─────────────────────────────────────────────────────

const REQUEST_SELECT = `
  *,
  destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(
    id, name, warehouse_code, warehouse_name, address, city, state
  ),
  requester:user_profiles!stock_requests_requested_by_fkey(
    id, full_name, email
  )
`;

const REQUEST_WITH_LINES_SELECT = `
  *,
  destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(
    id, name, warehouse_code, warehouse_name, address, city, state
  ),
  requester:user_profiles!stock_requests_requested_by_fkey(
    id, full_name, email
  ),
  lines:stock_request_lines(
    *,
    item:materials!stock_request_lines_item_id_fkey(id, name),
    variant:company_variants!stock_request_lines_company_variant_id_fkey(id, variant_name)
  )
`;

/**
 * Fetch paginated stock requests with filters.
 */
export async function fetchStockRequests(
  organisationId: string,
  filters: StockRequestFilters = {},
): Promise<{ data: StockRequestRow[]; count: number }> {
  const pageSize = filters.page_size || 25;
  const page = filters.page || 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('stock_requests')
    .select(REQUEST_SELECT, { count: 'exact' })
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.destination_warehouse_id) {
    query = query.eq('destination_warehouse_id', filters.destination_warehouse_id);
  }
  if (filters.search) {
    query = query.ilike('request_number', `%${filters.search}%`);
  }
  if (filters.from_date) {
    query = query.gte('requested_at', filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte('requested_at', filters.to_date);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as StockRequestRow[], count: count ?? 0 };
}

/**
 * Fetch a single stock request with lines and allocations.
 */
export async function fetchStockRequest(requestId: string): Promise<StockRequestRow | null> {
  const { data, error } = await supabase
    .from('stock_requests')
    .select(REQUEST_WITH_LINES_SELECT)
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as StockRequestRow | null;
}

/**
 * Fetch allocations for a request.
 */
export async function fetchAllocations(requestId: string): Promise<StockRequestAllocationRow[]> {
  const { data, error } = await supabase
    .from('stock_request_allocations')
    .select(`
      *,
      source_warehouse:warehouses!stock_request_allocations_source_warehouse_id_fkey(
        id, name, warehouse_code, warehouse_name
      ),
      allocator:user_profiles!stock_request_allocations_allocated_by_fkey(
        id, full_name
      ),
      transfer:stock_transfers!stock_request_allocations_transfer_id_fkey(
        id, transfer_no, status
      )
    `)
    .eq('request_id', requestId)
    .order('allocated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StockRequestAllocationRow[];
}

/**
 * Fetch activity log for a request.
 */
export async function fetchActivityLog(
  requestId: string,
  page = 1,
  pageSize = 50,
): Promise<{ data: StockRequestActivityRow[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('stock_request_activity_log')
    .select(`
      *,
      actor:user_profiles!stock_request_activity_log_actor_id_fkey(
        id, full_name
      )
    `, { count: 'exact' })
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: (data ?? []) as StockRequestActivityRow[], count: count ?? 0 };
}

// ─── Stock Request mutations (via RPCs for atomicity) ───────────────────────

/**
 * Create a new stock request atomically.
 */
export async function createStockRequest(
  organisationId: string,
  input: CreateStockRequestInput,
): Promise<StockRequestRow> {
  const idempotencyKey = `wsr-create-${organisationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase.rpc('create_stock_request_atomic', {
    p_request: {
      organisation_id: organisationId,
      destination_warehouse_id: input.destination_warehouse_id,
      required_date: input.required_date || null,
      priority: input.priority,
      remarks: input.remarks || null,
    },
    p_lines: input.lines.map((line, idx) => ({
      item_id: line.item_id,
      company_variant_id: line.company_variant_id || null,
      requested_qty: line.requested_qty,
      notes: line.notes || null,
      line_number: idx + 1,
    })),
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data as StockRequestRow;
}

/**
 * Submit a draft stock request.
 */
export async function submitStockRequest(requestId: string): Promise<StockRequestRow> {
  const { data, error } = await supabase.rpc('submit_stock_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as StockRequestRow;
}

/**
 * Acknowledge a submitted request (move to Under Process).
 */
export async function acknowledgeStockRequest(requestId: string): Promise<StockRequestRow> {
  const { data, error } = await supabase.rpc('acknowledge_stock_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as StockRequestRow;
}

/**
 * Allocate stock from a source warehouse to a request line.
 */
export async function allocateStockRequest(
  input: AllocateStockRequestInput,
): Promise<StockRequestAllocationRow> {
  const idempotencyKey = `wsr-alloc-${input.request_line_id}-${input.source_warehouse_id}-${Date.now()}`;

  const { data, error } = await supabase.rpc('allocate_stock_request_atomic', {
    p_allocation: {
      ...input,
      company_variant_id: input.company_variant_id || null,
      idempotency_key: idempotencyKey,
    },
  });
  if (error) throw error;
  return data as StockRequestAllocationRow;
}

/**
 * Release/reallocate an allocation (emergency release).
 */
export async function releaseAllocation(
  input: ReleaseAllocationInput,
): Promise<StockRequestAllocationRow> {
  const { data, error } = await supabase.rpc('release_stock_request_allocation', {
    p_allocation_id: input.allocation_id,
    p_release_qty: input.release_qty,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data as StockRequestAllocationRow;
}

/**
 * Cancel a stock request.
 */
export async function cancelStockRequest(
  requestId: string,
  reason: string,
): Promise<StockRequestRow> {
  const { data, error } = await supabase.rpc('cancel_stock_request', {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as StockRequestRow;
}

/**
 * Update a draft stock request (before submission).
 */
export async function updateDraftRequest(
  requestId: string,
  updates: Partial<Pick<StockRequestRow, 'destination_warehouse_id' | 'required_date' | 'priority' | 'remarks'>>,
): Promise<StockRequestRow> {
  const { data, error } = await supabase
    .from('stock_requests')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'draft')
    .select(REQUEST_SELECT)
    .single();
  if (error) throw error;
  return data as StockRequestRow;
}

/**
 * Delete a draft stock request (only allowed for drafts with no allocations).
 */
export async function deleteDraftRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('stock_requests')
    .delete()
    .eq('id', requestId)
    .eq('status', 'draft');
  if (error) throw error;
}

// ─── Stock Availability ─────────────────────────────────────────────────────

/**
 * Get stock availability for an item at a specific warehouse.
 */
export async function getStockAvailability(
  organisationId: string,
  itemId: string,
  variantId: string | null,
  warehouseId: string,
): Promise<StockAvailability> {
  const { data, error } = await supabase.rpc('get_stock_availability', {
    p_org_id: organisationId,
    p_item_id: itemId,
    p_variant_id: variantId,
    p_warehouse_id: warehouseId,
  });
  if (error) throw error;
  return data as StockAvailability;
}

/**
 * Get stock availability for an item across all warehouses.
 */
export async function getStockAvailabilityAllWarehouses(
  organisationId: string,
  itemId: string,
  variantId: string | null,
): Promise<StockAvailability[]> {
  // Fetch all warehouse stocks for this item
  let query = supabase
    .from('item_stock')
    .select(`
      item_id,
      company_variant_id,
      warehouse_id,
      current_stock,
      warehouse:warehouses!item_stock_warehouse_id_fkey(id, name, warehouse_code, warehouse_name, is_active)
    `)
    .eq('organisation_id', organisationId)
    .eq('item_id', itemId)
    .gt('current_stock', 0);

  if (variantId) {
    query = query.eq('company_variant_id', variantId);
  } else {
    query = query.is('company_variant_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  // For each warehouse with stock, get full availability
  const results: StockAvailability[] = [];
  for (const stock of data ?? []) {
    const availability = await getStockAvailability(
      organisationId,
      itemId,
      variantId,
      stock.warehouse_id,
    );
    results.push(availability);
  }

  return results;
}

// ─── Fulfillment Queue ──────────────────────────────────────────────────────

/**
 * Fetch requests that need fulfillment attention.
 */
export async function fetchFulfillmentQueue(
  organisationId: string,
  page = 1,
  pageSize = 25,
): Promise<{ data: StockRequestRow[]; count: number }> {
  const fulfillmentStatuses: StockRequestStatus[] = [
    'submitted',
    'under_process',
    'partially_allocated',
    'allocated',
    'awaiting_dispatch',
    'partially_dispatched',
    'in_transit',
    'partially_received',
  ];

  return fetchStockRequests(organisationId, {
    status: fulfillmentStatuses,
    page,
    page_size: pageSize,
  });
}

/**
 * Convert confirmed allocations to a Transfer Order.
 */
export async function convertAllocationsToTransfer(
  requestId: string,
  allocationIds: string[],
  vehicleNo?: string,
  transporter?: string,
): Promise<{ status: string; transfer_id: string; transfer_no: string }> {
  const { data, error } = await supabase.rpc('convert_allocations_to_transfer', {
    p_request_id: requestId,
    p_allocation_ids: allocationIds,
    p_vehicle_no: vehicleNo || null,
    p_transporter: transporter || null,
  });
  if (error) throw error;
  return data as { status: string; transfer_id: string; transfer_no: string };
}
