// src/warehouse/stock-requests/useStockRequests.ts
// TanStack Query hooks for the Stock Request & Fulfillment module.
// Follows the query key factory pattern used throughout the codebase.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchStockRequests,
  fetchStockRequest,
  fetchAllocations,
  fetchActivityLog,
  fetchFulfillmentQueue,
  createStockRequest,
  submitStockRequest,
  acknowledgeStockRequest,
  allocateStockRequest,
  releaseAllocation,
  cancelStockRequest,
  updateDraftRequest,
  deleteDraftRequest,
  getStockAvailability,
  getStockAvailabilityAllWarehouses,
  convertAllocationsToTransfer,
} from './stockRequestService';
import type {
  StockRequestFilters,
  CreateStockRequestInput,
  AllocateStockRequestInput,
  ReleaseAllocationInput,
  StockRequestRow,
} from './types';

// ─── Query key factory ──────────────────────────────────────────────────────

export const stockRequestKeys = {
  all: ['stock_requests'] as const,
  lists: () => [...stockRequestKeys.all, 'list'] as const,
  list: (orgId: string, filters?: StockRequestFilters) =>
    [...stockRequestKeys.lists(), orgId, filters] as const,
  details: () => [...stockRequestKeys.all, 'detail'] as const,
  detail: (id: string) => [...stockRequestKeys.details(), id] as const,
  allocations: (requestId: string) =>
    [...stockRequestKeys.all, 'allocations', requestId] as const,
  activity: (requestId: string) =>
    [...stockRequestKeys.all, 'activity', requestId] as const,
  fulfillmentQueue: (orgId: string) =>
    [...stockRequestKeys.all, 'fulfillment_queue', orgId] as const,
  availability: (orgId: string, itemId: string, variantId: string | null, warehouseId: string) =>
    ['stock_availability', orgId, itemId, variantId, warehouseId] as const,
  availabilityAll: (orgId: string, itemId: string, variantId: string | null) =>
    ['stock_availability_all', orgId, itemId, variantId] as const,
};

// ─── Query hooks ────────────────────────────────────────────────────────────

/**
 * Fetch paginated list of stock requests.
 */
export function useStockRequests(filters: StockRequestFilters = {}) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  return useQuery({
    queryKey: stockRequestKeys.list(orgId, filters),
    queryFn: () => fetchStockRequests(orgId, filters),
    enabled: !!orgId,
  });
}

/**
 * Fetch a single stock request with lines.
 */
export function useStockRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: stockRequestKeys.detail(requestId ?? ''),
    queryFn: () => fetchStockRequest(requestId!),
    enabled: !!requestId,
  });
}

/**
 * Fetch allocations for a request.
 */
export function useStockRequestAllocations(requestId: string | undefined) {
  return useQuery({
    queryKey: stockRequestKeys.allocations(requestId ?? ''),
    queryFn: () => fetchAllocations(requestId!),
    enabled: !!requestId,
  });
}

/**
 * Fetch activity log for a request.
 */
export function useStockRequestActivity(requestId: string | undefined, page = 1) {
  return useQuery({
    queryKey: [...stockRequestKeys.activity(requestId ?? ''), page],
    queryFn: () => fetchActivityLog(requestId!, page),
    enabled: !!requestId,
  });
}

/**
 * Fetch fulfillment queue (requests needing allocation/action).
 */
export function useFulfillmentQueue(page = 1) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  return useQuery({
    queryKey: [...stockRequestKeys.fulfillmentQueue(orgId), page],
    queryFn: () => fetchFulfillmentQueue(orgId, page),
    enabled: !!orgId,
  });
}

/**
 * Get stock availability for an item at a specific warehouse.
 */
export function useStockAvailability(
  itemId: string | undefined,
  variantId: string | null,
  warehouseId: string | undefined,
) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  return useQuery({
    queryKey: stockRequestKeys.availability(orgId, itemId ?? '', variantId, warehouseId ?? ''),
    queryFn: () => getStockAvailability(orgId, itemId!, variantId, warehouseId!),
    enabled: !!orgId && !!itemId && !!warehouseId,
    staleTime: 1000 * 30, // 30s — availability data changes frequently
  });
}

/**
 * Get stock availability for an item across all warehouses.
 */
export function useStockAvailabilityAllWarehouses(
  itemId: string | undefined,
  variantId: string | null,
) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  return useQuery({
    queryKey: stockRequestKeys.availabilityAll(orgId, itemId ?? '', variantId),
    queryFn: () => getStockAvailabilityAllWarehouses(orgId, itemId!, variantId),
    enabled: !!orgId && !!itemId,
    staleTime: 1000 * 30,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────────────

/**
 * Create a new stock request.
 */
export function useCreateStockRequest() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  return useMutation({
    mutationFn: (input: CreateStockRequestInput) =>
      createStockRequest(orgId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      toast.success(`Stock Request ${(data as any)?.request_number || ''} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create stock request: ${error.message}`);
    },
  });
}

/**
 * Submit a draft stock request.
 */
export function useSubmitStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => submitStockRequest(requestId),
    onSuccess: (_data, requestId) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      toast.success('Stock Request submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
}

/**
 * Acknowledge/accept a submitted stock request for processing.
 */
export function useAcknowledgeStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => acknowledgeStockRequest(requestId),
    onSuccess: (_data, requestId) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.fulfillmentQueue('') });
      toast.success('Stock Request acknowledged — ready for fulfillment');
    },
    onError: (error: Error) => {
      toast.error(`Failed to acknowledge: ${error.message}`);
    },
  });
}

/**
 * Allocate stock from a source warehouse.
 */
export function useAllocateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AllocateStockRequestInput) => allocateStockRequest(input),
    onSuccess: (_data, input) => {
      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock_availability'] });
      queryClient.invalidateQueries({ queryKey: ['item_stock'] });
      toast.success('Stock allocated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });
}

/**
 * Release an allocation (emergency release/reallocation).
 */
export function useReleaseAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReleaseAllocationInput) => releaseAllocation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock_availability'] });
      queryClient.invalidateQueries({ queryKey: ['item_stock'] });
      toast.success('Allocation released successfully');
    },
    onError: (error: Error) => {
      toast.error(`Release failed: ${error.message}`);
    },
  });
}

/**
 * Cancel a stock request.
 */
export function useCancelStockRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      cancelStockRequest(requestId, reason),
    onSuccess: (_data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['stock_availability'] });
      toast.success('Stock Request cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Cancellation failed: ${error.message}`);
    },
  });
}

/**
 * Update a draft stock request.
 */
export function useUpdateDraftRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      updates,
    }: {
      requestId: string;
      updates: Partial<Pick<StockRequestRow, 'destination_warehouse_id' | 'required_date' | 'priority' | 'remarks'>>;
    }) => updateDraftRequest(requestId, updates),
    onSuccess: (_data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      toast.success('Draft updated');
    },
    onError: (error: Error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });
}

/**
 * Delete a draft stock request.
 */
export function useDeleteDraftRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => deleteDraftRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      toast.success('Draft deleted');
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

/**
 * Convert allocations to a Transfer Order.
 */
export function useConvertAllocationsToTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      allocationIds,
      vehicleNo,
      transporter,
    }: {
      requestId: string;
      allocationIds: string[];
      vehicleNo?: string;
      transporter?: string;
    }) => convertAllocationsToTransfer(requestId, allocationIds, vehicleNo, transporter),
    onSuccess: (data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.allocations(requestId) });
      queryClient.invalidateQueries({ queryKey: stockRequestKeys.lists() });
      toast.success(`Transfer Order ${(data as any)?.transfer_no || ''} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });
}
