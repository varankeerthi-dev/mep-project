import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { BOMHeader, BOMItem } from '../model/types';
import { SaveBOMPayloadSchema } from '../validation/bomSchemas';
import { toast } from '../../../lib/logger';

export function useBomsListQuery(orgId: string | undefined, statusFilter: 'active' | 'inactive' | 'all', search: string) {
  return useQuery({
    queryKey: ['boms', orgId, statusFilter, search],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchBOMHeaders(orgId, statusFilter, search);
    },
    enabled: !!orgId,
  });
}

export function useBomsForJobCardQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['boms-for-job-card', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchBOMHeaders(orgId, 'active');
    },
    enabled: !!orgId,
  });
}

export function useBomDetailQuery(bomId: string | null) {
  return useQuery({
    queryKey: ['bom-detail', bomId],
    queryFn: async () => {
      if (!bomId) return null;
      const header = await P.fetchBOMHeaderById(bomId);
      const items = await P.fetchBOMItemsByHeaderId(bomId);
      return { header, items };
    },
    enabled: !!bomId,
  });
}

export function useSaveBOMMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { header: Partial<BOMHeader>; items: Partial<BOMItem>[] }) => {
      const validated = SaveBOMPayloadSchema.parse(payload);
      return R.saveBOMAggregate(validated.header, validated.items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success('BOM saved successfully');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save BOM');
    },
  });
}

export function useDeleteBOMMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bomId: string) => {
      return R.deleteBOM(bomId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success('BOM deleted successfully');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete BOM');
    },
  });
}

export function useCloneBOMMutation(onSuccessCallback?: (newBomId: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceBomId, orgId }: { sourceBomId: string; orgId: string }) => {
      return R.cloneBOM(sourceBomId, orgId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success('BOM cloned successfully');
      if (onSuccessCallback) onSuccessCallback(variables.sourceBomId);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to clone BOM');
    },
  });
}

export function useRawMaterialsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['materials-for-bom', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchRawMaterialsForBom(orgId);
    },
    enabled: !!orgId,
  });
}

export function useCompanyVariantsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['company-variants-bom', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchCompanyVariants(orgId);
    },
    enabled: !!orgId,
  });
}

export function useItemVariantPricingQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['bom-variant-pricing', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchItemVariantPricing(orgId);
    },
    enabled: !!orgId,
  });
}

export function useFinishedGoodsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['finished-goods', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchFinishedGoods(orgId);
    },
    enabled: !!orgId,
  });
}

export function useBomItemsQuery(bomId: string | null) {
  return useQuery({
    queryKey: ['bom-items', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      return P.fetchBOMItemsByHeaderId(bomId);
    },
    enabled: !!bomId,
  });
}

export function usePublishBOMMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bomId, orgId }: { bomId: string; orgId: string }) => {
      return R.publishBOM(bomId, orgId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      queryClient.invalidateQueries({ queryKey: ['bom-detail'] });
      toast.success('BOM published and locked as immutable');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to publish BOM');
    },
  });
}

export function useCreateBOMRevisionMutation(onSuccessCallback?: (newBomId: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceBomId, orgId }: { sourceBomId: string; orgId: string }) => {
      return R.createBOMRevision(sourceBomId, orgId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success(`New draft BOM revision ${data.new_revision} created`);
      if (onSuccessCallback && data.new_bom_id) onSuccessCallback(data.new_bom_id);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create BOM revision');
    },
  });
}

export function useBOMExplosionQuery(bomId: string | null, productionQty: number = 1, productionDate?: string) {
  return useQuery({
    queryKey: ['bom-explosion', bomId, productionQty, productionDate],
    queryFn: async () => {
      if (!bomId) return [];
      return R.explodeBOM(bomId, productionQty, productionDate);
    },
    enabled: !!bomId,
  });
}
