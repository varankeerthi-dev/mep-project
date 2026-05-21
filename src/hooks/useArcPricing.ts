import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchArcPricingForItems,
  getArcRate,
  upsertArcRate,
  deleteArcRate,
  getArcRatesForClient,
  getArcRatesForItem,
  type MaterialClientPricingRow,
} from '@/lib/arc-pricing';

/**
 * Hook to fetch ARC pricing for multiple items for a client.
 * Uses material_client_pricing table.
 * Returns all variant-specific rates per item.
 */
export function useArcPricingForItems(
  clientId: string | null,
  itemIds: string[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['arc-pricing', 'items', clientId, itemIds],
    queryFn: async () => {
      if (!clientId || itemIds.length === 0) {
        return {} as Record<string, { item_id: string; arc_rate: number; company_variant_id: string | null; pricing_type: string; is_active: boolean }[]>;
      }
      return fetchArcPricingForItems(clientId, itemIds);
    },
    enabled: enabled && Boolean(clientId) && itemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get ARC rate for a single item with variant specificity.
 */
export function useArcRate(
  clientId: string | null,
  itemId: string | null,
  variantId?: string | null,
  useArcPricing: boolean = true
) {
  return useQuery({
    queryKey: ['arc-rate', clientId, itemId, variantId],
    queryFn: async () => {
      if (!clientId || !itemId) {
        return null;
      }
      return getArcRate(clientId, itemId, variantId);
    },
    enabled: useArcPricing && Boolean(clientId) && Boolean(itemId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get all ARC rates for a client.
 */
export function useArcRatesForClient(clientId: string | null) {
  return useQuery({
    queryKey: ['arc-pricing', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return getArcRatesForClient(clientId);
    },
    enabled: Boolean(clientId),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to get all ARC rates for an item.
 */
export function useArcRatesForItem(itemId: string | null) {
  return useQuery({
    queryKey: ['arc-pricing', 'item', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      return getArcRatesForItem(itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to upsert a single ARC rate.
 */
export function useUpsertArcRate(options?: {
  onSuccess?: (success: boolean) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      itemId: string;
      arcRate: number;
      variantId?: string | null;
      organisationId?: string;
    }) => {
      return upsertArcRate(
        params.clientId,
        params.itemId,
        params.arcRate,
        params.variantId,
        params.organisationId
      );
    },
    onSuccess: (success, variables, context) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'client', variables.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'item', variables.itemId],
      });
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'items', variables.clientId],
      });
      options?.onSuccess?.(success);
    },
    onError: (error, variables, context) => {
      console.error('Error upserting ARC rate:', error);
      options?.onError?.(error);
    },
  });
}

/**
 * Hook to delete an ARC rate.
 */
export function useDeleteArcRate(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; clientId: string; itemId: string }) => {
      const success = await deleteArcRate(params.id);
      if (!success) {
        throw new Error('Failed to delete ARC rate');
      }
      return params;
    },
    onSuccess: (data, variables, context) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'client', data.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'item', data.itemId],
      });
      queryClient.invalidateQueries({
        queryKey: ['arc-pricing', 'items', data.clientId],
      });
      options?.onSuccess?.();
    },
    onError: (error, variables, context) => {
      console.error('Error deleting ARC rate:', error);
      options?.onError?.(error);
    },
  });
}

/**
 * Hook to get ARC pricing status for items.
 * Returns summary of which items have ARC rates.
 */
export function useArcPricingStatus(
  clientId: string | null,
  itemIds: string[],
  useArcPricing: boolean
) {
  const query = useQuery({
    queryKey: ['arc-pricing-status', clientId, itemIds],
    queryFn: async () => {
      if (!clientId || itemIds.length === 0) {
        return {
          totalItems: 0,
          itemsWithArcRate: 0,
          itemsWithoutArcRate: 0,
          allHaveArcRate: true,
        };
      }

      const arcPricingMap = await fetchArcPricingForItems(clientId, itemIds);
      
      const itemsWithArcRate = Object.values(arcPricingMap).filter(v => v !== null).length;
      const itemsWithoutArcRate = itemIds.length - itemsWithArcRate;
      
      return {
        totalItems: itemIds.length,
        itemsWithArcRate,
        itemsWithoutArcRate,
        allHaveArcRate: itemsWithoutArcRate === 0,
      };
    },
    enabled: useArcPricing && Boolean(clientId) && itemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    status: query.data ?? null,
    isLoading: query.isLoading,
  };
}