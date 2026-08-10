import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { MaterialRequisition, MaterialRequisitionItem, GoodsReceiptNote, GRNItem } from '../model/types';
import { toast } from '../../../lib/logger';
import * as PR from '../repository/procurement/procurementRepository';

// =========================================================================
// Material Requisition Hooks
// =========================================================================

export function useMaterialRequisitionsListQuery(orgId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['material-requisitions', orgId, status],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchMaterialRequisitions(orgId, status);
    },
    enabled: !!orgId,
  });
}

export function useMaterialRequisitionDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['material-requisition', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchMaterialRequisitionById(id);
    },
    enabled: !!id,
  });
}

export function useMaterialRequisitionItemsQuery(requisitionId: string | undefined) {
  return useQuery({
    queryKey: ['material-requisition-items', requisitionId],
    queryFn: async () => {
      if (!requisitionId) return [];
      return P.fetchMaterialRequisitionItems(requisitionId);
    },
    enabled: !!requisitionId,
  });
}

export function useCreateMaterialRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requisition,
      items,
      orgId,
    }: {
      requisition: Omit<MaterialRequisition, 'id' | 'requisition_no' | 'created_at' | 'updated_at'>;
      items: Omit<MaterialRequisitionItem, 'id' | 'requisition_id' | 'created_at'>[];
      orgId: string;
    }) => {
      return PR.createMaterialRequisitionAggregate(requisition, items, orgId);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['material-requisitions', variables.orgId] });
      toast.success(`Material requisition ${data.requisition.requisition_no} submitted successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit material requisition');
    },
  });
}

export function useIssueMaterialRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requisitionId,
      orgId,
      userId,
      userName,
    }: {
      requisitionId: string;
      orgId: string;
      userId: string;
      userName: string;
    }) => {
      return R.issueMaterialRequisitionAggregate(requisitionId, orgId, userId, userName);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['material-requisitions', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['material-requisition', data.id] });
      queryClient.invalidateQueries({ queryKey: ['material-requisition-items', data.id] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card', data.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', data.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['item-stocks'] });
      toast.success(`Materials issued successfully for requisition ${data.requisition_no}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to issue materials');
    },
  });
}

// =========================================================================
// Goods Receipt Notes (GRN) Hooks
// =========================================================================

export function useGoodsReceiptNotesListQuery(orgId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['goods-receipt-notes', orgId, status],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchGoodsReceiptNotes(orgId, status);
    },
    enabled: !!orgId,
  });
}

export function useGoodsReceiptNoteDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['goods-receipt-note', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchGoodsReceiptNoteById(id);
    },
    enabled: !!id,
  });
}

export function useGRNItemsQuery(grnId: string | undefined) {
  return useQuery({
    queryKey: ['grn-items', grnId],
    queryFn: async () => {
      if (!grnId) return [];
      return P.fetchGRNItems(grnId);
    },
    enabled: !!grnId,
  });
}

export function useCreateGoodsReceiptNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      grn,
      items,
      orgId,
    }: {
      grn: Omit<GoodsReceiptNote, 'id' | 'grn_no' | 'created_at' | 'updated_at'>;
      items: Omit<GRNItem, 'id' | 'grn_id' | 'created_at'>[];
      orgId: string;
    }) => {
      return PR.createGoodsReceiptNoteAggregate(grn, items, orgId);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes', variables.orgId] });
      toast.success(`Goods Receipt Note ${data.grn.grn_no} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create Goods Receipt Note');
    },
  });
}

export function useConfirmGRNAcceptanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      grnId,
      orgId,
      userId,
      userName,
    }: {
      grnId: string;
      orgId: string;
      userId: string;
      userName: string;
    }) => {
      return PR.confirmGRNAcceptanceAggregate(grnId, orgId, userId, userName);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-note', data.id] });
      queryClient.invalidateQueries({ queryKey: ['grn-items', data.id] });
      queryClient.invalidateQueries({ queryKey: ['item-stocks'] });
      toast.success(`GRN ${data.grn_no} confirmed and raw materials received into Main Store!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to accept Goods Receipt Note');
    },
  });
}
