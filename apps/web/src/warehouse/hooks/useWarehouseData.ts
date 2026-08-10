// src/warehouse/hooks/useWarehouseData.ts
// React Query hooks for the Warehouse module (react-query → services →
// backend, per TAD §13.24 state management layering).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';
import * as warehouseService from '../services/warehouseService';
import { buildDashboardViewModel } from '../dashboard';
import type { CapacityProfileRow, CycleCountBatchStatus, DispatchStatus, PickListStatus, TransferStatus, WarehouseDraft } from '../types';

export const WAREHOUSE_QUERY_KEYS = {
  warehouses: (orgId?: string) => ['warehouses', orgId] as const,
  structure: (warehouseId?: string) => ['warehouse-structure', warehouseId] as const,
  floors: (warehouseId?: string) => ['warehouse-floors', warehouseId] as const,
  zones: ['warehouse-zones'] as const,
  layouts: ['warehouse-layouts'] as const,
  racks: ['warehouse-racks'] as const,
  bins: ['warehouse-bins'] as const,
} as const;

export function useWarehouses() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: WAREHOUSE_QUERY_KEYS.warehouses(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchWarehouses(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

export function useWarehouseStructure(warehouseId?: string) {
  return useQuery({
    queryKey: WAREHOUSE_QUERY_KEYS.structure(warehouseId),
    queryFn: () => warehouseService.fetchStructure(warehouseId!),
    enabled: !!warehouseId,
  });
}

export function useWarehouseViewer(warehouseId?: string) {
  return useQuery({
    queryKey: ['warehouse-viewer', warehouseId] as const,
    queryFn: () => warehouseService.fetchViewerData(warehouseId!),
    enabled: !!warehouseId,
    staleTime: 30_000,
  });
}

export function useWarehouseFloors(warehouseId?: string) {
  return useQuery({
    queryKey: WAREHOUSE_QUERY_KEYS.floors(warehouseId),
    queryFn: async () => {
      if (!warehouseId) return [];
      const { data, error } = await supabase
        .from('warehouse_floors')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null)
        .order('display_order');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!warehouseId,
  });
}

export function useSaveWarehouseDraft() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { draft: WarehouseDraft; warehouseId?: string }) =>
      warehouseService.saveWarehouseDraft(vars.draft, organisation?.id ?? '', user?.id ?? '', vars.warehouseId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: WAREHOUSE_QUERY_KEYS.warehouses(organisation?.id) });
      queryClient.invalidateQueries({ queryKey: WAREHOUSE_QUERY_KEYS.structure(result.warehouseId) });
      queryClient.invalidateQueries({ queryKey: ['warehouse-floors'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-zones'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-layouts'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-racks'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
    },
  });
}

export function useDeleteWarehouse() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseService.softDeleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WAREHOUSE_QUERY_KEYS.warehouses(organisation?.id) });
    },
  });
}

// ─── Capacity profiles (G9) ───────────────────────────────────────────────────

export function useCapacityProfiles() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-capacity-profiles', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchCapacityProfiles(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

export function useCreateCapacityProfile() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: Partial<CapacityProfileRow>) =>
      warehouseService.createCapacityProfile(organisation?.id ?? '', user?.id ?? '', fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-capacity-profiles'] });
    },
  });
}

export function useUpdateCapacityProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<CapacityProfileRow> }) =>
      warehouseService.updateCapacityProfile(id, user?.id ?? '', fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-capacity-profiles'] });
    },
  });
}

export function useDeleteCapacityProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseService.softDeleteCapacityProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-capacity-profiles'] });
    },
  });
}

// ─── Phase 3 — inventory location management ─────────────────────────────────

export function useAssignableItems() {
  return useQuery({
    queryKey: ['warehouse-assignable-items'] as const,
    queryFn: () => warehouseService.fetchAssignableItems(),
    staleTime: 60_000,
  });
}

/**
 * Everything the Inventory grid needs: hierarchy + bin items resolved with
 * item names. Reuses fetchViewerData (structure + binItems + itemsByBin).
 */
export function useInventory(warehouseId?: string) {
  return useQuery({
    queryKey: ['warehouse-inventory', warehouseId] as const,
    queryFn: () => warehouseService.fetchViewerData(warehouseId!),
    enabled: !!warehouseId,
  });
}

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>, warehouseId?: string) {
  if (warehouseId) {
    queryClient.invalidateQueries({ queryKey: ['warehouse-viewer', warehouseId] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-inventory', warehouseId] });
  }
  // Every inventory mutation now flows through the Movement Engine, so the
  // audit trail + operation views must refresh too (TAD §5.4).
  queryClient.invalidateQueries({ queryKey: ['warehouse-movements'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-bin-items'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-bin-candidates'] });
}

export function useAssignBinItem() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { warehouseId?: string; assignment: warehouseService.BinItemAssignment }) =>
      warehouseService.upsertBinItem(organisation?.id ?? '', user?.id ?? '', vars.assignment),
    onSuccess: (_data, vars) => invalidateInventory(queryClient, vars.warehouseId),
  });
}

export function useAdjustBinItemQty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { warehouseId?: string; rowId: string; delta: number }) =>
      warehouseService.adjustBinItemQty(vars.rowId, vars.delta, user?.id),
    onSuccess: (_data, vars) => invalidateInventory(queryClient, vars.warehouseId),
  });
}

export function useDeleteBinItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { warehouseId?: string; rowId: string }) =>
      warehouseService.deleteBinItem(vars.rowId, user?.id),
    onSuccess: (_data, vars) => invalidateInventory(queryClient, vars.warehouseId),
  });
}

export function useSetBinItemFlags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { warehouseId?: string; rowId: string; flags: { isPrimary?: boolean; isReserve?: boolean } }) =>
      warehouseService.setBinItemFlags(vars.rowId, vars.flags),
    onSuccess: (_data, vars) => invalidateInventory(queryClient, vars.warehouseId),
  });
}

// ─── Layout version history (G10, TAD §4.9) ───────────────────────────────────

export function useLayoutHistory(warehouseId?: string) {
  return useQuery({
    queryKey: ['warehouse-layout-history', warehouseId] as const,
    queryFn: () => warehouseService.fetchLayoutHistory(warehouseId!),
    enabled: !!warehouseId,
  });
}

// ─── Phase 4 — Warehouse Operations ───────────────────────────────────────────

function invalidateOperations(queryClient: ReturnType<typeof useQueryClient>, orgId?: string) {
  queryClient.invalidateQueries({ queryKey: ['warehouse-transfers', orgId] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-movements'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-replenishment-rules'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-bin-candidates'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-bin-items'] });
}

export function useTransfers() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-transfers', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchTransfers(organisation.id);
    },
    enabled: !!organisation?.id,
    refetchInterval: 30_000,
  });
}

export function useCreateTransfer() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: warehouseService.CreateTransferInput) =>
      warehouseService.createTransfer(organisation?.id ?? '', user?.id ?? '', input),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useAdvanceTransfer() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { transferId: string; to: TransferStatus }) =>
      warehouseService.advanceTransferStatus(vars.transferId, vars.to, user?.id ?? ''),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useExecuteTransfer() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) =>
      warehouseService.executeTransfer(transferId, user?.id ?? '', 'web'),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useMovements(binId?: string, itemId?: string) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-movements', organisation?.id, binId, itemId] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchMovements(organisation.id, { binId, itemId });
    },
    enabled: !!organisation?.id,
  });
}

export function useOrgBinItems() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-org-bin-items', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchOrgBinItems(organisation.id);
    },
    enabled: !!organisation?.id,
    staleTime: 15_000,
  });
}

export function useBinCandidates() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-bin-candidates', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchBinCandidates(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

export function useReceiveStock() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { binId: string; itemId: string; quantity: number; remarks?: string | null }) =>
      warehouseService.receiveStock({
        organisationId: organisation?.id ?? '',
        binId: args.binId,
        itemId: args.itemId,
        quantity: args.quantity,
        operatorId: user?.id ?? '',
        remarks: args.remarks,
      }),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useReplenishmentRules() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-replenishment-rules', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchReplenishmentRules(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

export function useUpsertReplenishmentRule() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: { binId: string; itemId: string; minQty: number; maxQty: number }) =>
      warehouseService.upsertReplenishmentRule(organisation?.id ?? '', user?.id ?? '', rule),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useSetReplenishmentRuleEnabled() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      warehouseService.setReplenishmentRuleEnabled(vars.id, vars.enabled),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useDeleteReplenishmentRule() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehouseService.deleteReplenishmentRule(id),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

export function useExecuteReplenishment() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { sourceBinId: string; destinationBinId: string; itemId: string; quantity: number }) =>
      warehouseService.executeReplenishment({
        organisationId: organisation?.id ?? '',
        ...args,
        operatorId: user?.id ?? '',
      }),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

// ─── Phase 4 — Dispatch workflow ─────────────────────────────────────────────

function invalidateDispatches(queryClient: ReturnType<typeof useQueryClient>, orgId?: string) {
  queryClient.invalidateQueries({ queryKey: ['warehouse-dispatches', orgId] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-movements'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-bin-candidates'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-bin-items'] });
}

export function useDispatches() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-dispatches', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchDispatches(organisation.id);
    },
    enabled: !!organisation?.id,
    refetchInterval: 30_000,
  });
}

export function useCreateDispatch() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: warehouseService.CreateDispatchInput) =>
      warehouseService.createDispatch(organisation?.id ?? '', user?.id ?? '', input),
    onSuccess: () => invalidateDispatches(queryClient, organisation?.id),
  });
}

export function useAdvanceDispatch() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { dispatchId: string; to: DispatchStatus }) =>
      warehouseService.advanceDispatchStatus(vars.dispatchId, vars.to, user?.id ?? ''),
    onSuccess: () => invalidateDispatches(queryClient, organisation?.id),
  });
}

export function useReserveDispatch() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dispatchId: string) =>
      warehouseService.reserveDispatch(dispatchId, user?.id ?? ''),
    onSuccess: () => invalidateDispatches(queryClient, organisation?.id),
  });
}

export function useReleaseDispatchReserve() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dispatchId: string) =>
      warehouseService.releaseDispatchReserve(dispatchId, user?.id ?? ''),
    onSuccess: () => invalidateDispatches(queryClient, organisation?.id),
  });
}

export function useExecuteDispatch() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { dispatchId: string; vehicleNo?: string | null; driverName?: string | null }) =>
      warehouseService.executeDispatch({
        dispatchId: vars.dispatchId,
        operatorId: user?.id ?? '',
        vehicleNo: vars.vehicleNo,
        driverName: vars.driverName,
      }),
    onSuccess: () => invalidateDispatches(queryClient, organisation?.id),
  });
}

// ─── TAD §5.12 — Movement reversal ───────────────────────────────────────────

export function useReverseMovement() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) =>
      warehouseService.reverseMovement(movementId, user?.id ?? ''),
    onSuccess: () => invalidateOperations(queryClient, organisation?.id),
  });
}

// ─── Phase 5 — Dashboard (TAD §2.15 Dashboard Engine) ───────────────────────

export function useDashboard() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-dashboard', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return null;
      const raw = await warehouseService.fetchDashboardData(organisation.id);
      return buildDashboardViewModel(raw);
    },
    enabled: !!organisation?.id,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

// ─── TAD §3.12 — Picking Module ──────────────────────────────────────────────

function invalidatePicking(queryClient: ReturnType<typeof useQueryClient>, orgId?: string) {
  queryClient.invalidateQueries({ queryKey: ['warehouse-pick-lists', orgId] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-movements'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-bin-candidates'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-bin-items'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-dispatches', orgId] });
}

export function usePickLists() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-pick-lists', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchPickLists(organisation.id);
    },
    enabled: !!organisation?.id,
    refetchInterval: 30_000,
  });
}

export function useCreatePickList() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: warehouseService.CreatePickListInput) =>
      warehouseService.createPickList(organisation?.id ?? '', user?.id ?? '', input),
    onSuccess: () => invalidatePicking(queryClient, organisation?.id),
  });
}

export function useAdvancePickList() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { pickListId: string; to: PickListStatus }) =>
      warehouseService.advancePickListStatus(vars.pickListId, vars.to, user?.id ?? ''),
    onSuccess: () => invalidatePicking(queryClient, organisation?.id),
  });
}

export function useUpdatePickLineQty() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lineId: string; quantityPicked: number }) =>
      warehouseService.updatePickLineQty(vars.lineId, vars.quantityPicked),
    onSuccess: () => invalidatePicking(queryClient, organisation?.id),
  });
}

export function useCompletePickList() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pickListId: string) =>
      warehouseService.completePickList(pickListId, user?.id ?? ''),
    onSuccess: () => invalidatePicking(queryClient, organisation?.id),
  });
}

// ─── Phase 7 — Cycle Count (PRD §4.21) ───────────────────────────────────────

function invalidateCycleCounts(queryClient: ReturnType<typeof useQueryClient>, orgId?: string) {
  queryClient.invalidateQueries({ queryKey: ['warehouse-cycle-counts', orgId] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-structure'] });
  // Approvals adjust stock through the Movement Engine → refresh everything downstream.
  queryClient.invalidateQueries({ queryKey: ['warehouse-movements'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-bin-candidates'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-org-bin-items'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard', orgId] });
}

/** Org-wide search index for the universal search bar (PRD §2.8). */
export function useSearchIndex() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-search-index', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return { bins: [], zones: [], racks: [], items: [] };
      return warehouseService.fetchSearchIndex(organisation.id);
    },
    enabled: !!organisation?.id,
    staleTime: 60_000,
  });
}

/** Org-wide structure (floors/zones/layouts/racks/tiers/bins) for scope pickers. */
export function useOrgStructure() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-org-structure', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return { floors: [], zones: [], layouts: [], racks: [], tiers: [], bins: [] };
      return warehouseService.fetchOrgStructure(organisation.id);
    },
    enabled: !!organisation?.id,
  });
}

/** Open purchase orders for PO-driven receiving (PRD §4.12). */
export function useOpenPurchaseOrders() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-open-pos', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchOpenPurchaseOrders(organisation.id);
    },
    enabled: !!organisation?.id,
    refetchInterval: 30_000,
  });
}

/** All cycle-count batches enriched with items + names (refreshes every 30s). */
export function useCycleCounts() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: ['warehouse-cycle-counts', organisation?.id] as const,
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warehouseService.fetchCycleCounts(organisation.id);
    },
    enabled: !!organisation?.id,
    refetchInterval: 30_000,
  });
}

export function useCreateCycleCountBatch() {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof warehouseService.createCycleCountBatch>[0], 'organisationId' | 'operatorId'>) =>
      warehouseService.createCycleCountBatch({ ...input, organisationId: organisation?.id ?? '', operatorId: user?.id ?? '' }),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export function useFreezeCycleScope() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => warehouseService.freezeCycleScope(batchId, user?.id ?? ''),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export function useUnfreezeCycleScope() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => warehouseService.unfreezeCycleScope(batchId, user?.id ?? ''),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export function useSubmitCycleCountItem() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lineId: string; countedQty: number; note?: string | null }) =>
      warehouseService.submitCycleCountItem({ ...vars, operatorId: user?.id ?? '' }),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export function useApproveCycleCountBatch() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => warehouseService.approveCycleCountBatch(batchId, user?.id ?? ''),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export function useCancelCycleCountBatch() {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => warehouseService.cancelCycleCountBatch(batchId, user?.id ?? ''),
    onSuccess: () => invalidateCycleCounts(queryClient, organisation?.id),
  });
}

export type { CycleCountBatchStatus };

// Re-export the state-machine helpers so the UI uses one source of truth.
export { canFreeze, canApprove, canCancel, CYCLE_STATUS_META, CYCLE_QUEUE_ORDER } from '../cycleCount';
