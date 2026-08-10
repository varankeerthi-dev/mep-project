import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { DispatchOrder, DispatchItem, DispatchPacking, DispatchCountVerification } from '../model/types';
import { toast } from '../../../lib/logger';

export function useDispatchOrdersListQuery(orgId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['dispatch-orders', orgId, status],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchDispatchOrders(orgId, status);
    },
    enabled: !!orgId,
  });
}

export function useDispatchOrderDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['dispatch-order', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchDispatchOrderById(id);
    },
    enabled: !!id,
  });
}

export function useDispatchOrderItemsQuery(dispatchOrderId: string | undefined) {
  return useQuery({
    queryKey: ['dispatch-order-items', dispatchOrderId],
    queryFn: async () => {
      if (!dispatchOrderId) return [];
      return P.fetchDispatchItems(dispatchOrderId);
    },
    enabled: !!dispatchOrderId,
  });
}

export function useDispatchOrderPackingQuery(dispatchOrderId: string | undefined) {
  return useQuery({
    queryKey: ['dispatch-order-packing', dispatchOrderId],
    queryFn: async () => {
      if (!dispatchOrderId) return [];
      return P.fetchDispatchPacking(dispatchOrderId);
    },
    enabled: !!dispatchOrderId,
  });
}

export function useDispatchOrderCountVerificationsQuery(dispatchOrderId: string | undefined) {
  return useQuery({
    queryKey: ['dispatch-order-count-verifications', dispatchOrderId],
    queryFn: async () => {
      if (!dispatchOrderId) return [];
      return P.fetchDispatchCountVerifications(dispatchOrderId);
    },
    enabled: !!dispatchOrderId,
  });
}

export function useCreateDispatchOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order,
      items,
      orgId,
    }: {
      order: Omit<DispatchOrder, 'id' | 'dispatch_no' | 'created_at' | 'updated_at'>;
      items: Omit<DispatchItem, 'id' | 'dispatch_order_id' | 'created_at'>[];
      orgId: string;
    }) => {
      return R.createDispatchOrderAggregate(order, items, orgId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders', variables.orgId] });
      toast.success('Dispatch order created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create dispatch order');
    },
  });
}

export function useUpdateDispatchOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<DispatchOrder>;
    }) => {
      return P.updateDispatchOrder(id, updates);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-order', data.id] });
      toast.success('Dispatch order updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update dispatch order');
    },
  });
}

export function useUpdateDispatchItemQtyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dispatchOrderId,
      qtyUpdates,
    }: {
      id: string;
      dispatchOrderId: string;
      qtyUpdates: Partial<Pick<DispatchItem, 'picked_qty' | 'packed_qty' | 'dispatched_qty' | 'status'>>;
    }) => {
      return P.updateDispatchItemQty(id, qtyUpdates);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-order-items', variables.dispatchOrderId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update item quantity');
    },
  });
}

export function useConfirmDispatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dispatchOrderId,
      orgId,
      userId,
      userName,
    }: {
      dispatchOrderId: string;
      orgId: string;
      userId: string;
      userName: string;
    }) => {
      return R.confirmDispatchAggregate(dispatchOrderId, orgId, userId, userName);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-order-items', data.id] });
      queryClient.invalidateQueries({ queryKey: ['item-stocks'] });
      toast.success(`Dispatch order ${data.dispatch_no} confirmed and items shipped!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to confirm dispatch');
    },
  });
}

export function useUpsertDispatchCountVerificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dispatchOrderId,
      verifications,
    }: {
      dispatchOrderId: string;
      verifications: Omit<DispatchCountVerification, 'id' | 'created_at'>[];
    }) => {
      return P.upsertDispatchCountVerification(verifications);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-order-count-verifications', variables.dispatchOrderId] });
      toast.success('Count verifications saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save count verifications');
    },
  });
}
