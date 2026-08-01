import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { JobCard, JobCardMaterial } from '../model/types';
import { toast } from '../../../lib/logger';

export function useJobCardsListQuery(orgId: string | undefined, statusFilters?: string[]) {
  return useQuery({
    queryKey: ['job-cards', orgId, statusFilters],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchJobCards(orgId, statusFilters);
    },
    enabled: !!orgId,
  });
}

export function useJobCardDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['job-card', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchJobCardById(id);
    },
    enabled: !!id,
  });
}

export function useJobCardMaterialsQuery(jobCardId: string | undefined) {
  return useQuery({
    queryKey: ['job-card-materials', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      return P.fetchJobCardMaterials(jobCardId);
    },
    enabled: !!jobCardId,
  });
}

export function useJobCardStockQuery(materialIds: string[], orgId: string | undefined) {
  return useQuery({
    queryKey: ['job-card-stock', materialIds, orgId],
    queryFn: async () => {
      if (!orgId || materialIds.length === 0) return {};
      const stockRows = await P.fetchStockByMaterials(materialIds, orgId);
      
      const whIds = [...new Set(stockRows.map((r) => r.warehouse_id).filter(Boolean))];
      const whMap: Record<string, string> = {};
      if (whIds.length > 0) {
        const warehouses = await P.fetchWarehouses(orgId);
        for (const w of warehouses) {
          whMap[w.id] = w.name;
        }
      }

      const map: Record<string, { warehouse_id: string; warehouse_name: string; warehouse_purpose: string; current_stock: number }[]> = {};
      for (const row of stockRows) {
        if (!map[row.item_id]) {
          map[row.item_id] = [];
        }
        map[row.item_id].push({
          warehouse_id: row.warehouse_id,
          warehouse_name: whMap[row.warehouse_id] || 'Store',
          warehouse_purpose: 'general',
          current_stock: row.current_stock || 0,
        });
      }
      return map;
    },
    enabled: !!orgId && materialIds.length > 0,
  });
}

export function useWarehousesQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['manufacturing-warehouses', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchWarehouses(orgId);
    },
    enabled: !!orgId,
  });
}

export function useCreateJobCardMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { jobCard: Partial<JobCard>; materials: Partial<JobCardMaterial>[] }) => {
      return R.createJobCardAggregate(payload.jobCard, payload.materials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      toast.success('Job card created successfully');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create job card');
    },
  });
}

export function useIssueMaterialsMutation(
  jobCardNo: string,
  onSuccessCallback?: () => void,
  onErrorCallback?: (err: string) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { jobCardId: string; orgId: string; userId: string }) => {
      return R.issueJobCardMaterials(payload.jobCardId, payload.orgId, payload.userId, jobCardNo);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-card', variables.jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', variables.jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-stock'] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      toast.success('Materials issued to production');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      const errMsg = err?.message || 'Failed to issue materials';
      toast.error(errMsg);
      if (onErrorCallback) onErrorCallback(errMsg);
    },
  });
}

export function useReturnMaterialsMutation(
  onSuccessCallback?: () => void,
  onErrorCallback?: (err: string) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { jobCardId: string; orgId: string; returnQuantities: Record<string, number> }) => {
      return R.returnJobCardMaterials(payload.jobCardId, payload.orgId, payload.returnQuantities);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-card', variables.jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', variables.jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-stock'] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      toast.success('Materials returned to store');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      const errMsg = err?.message || 'Failed to return materials';
      toast.error(errMsg);
      if (onErrorCallback) onErrorCallback(errMsg);
    },
  });
}

export function useDeleteJobCardMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return P.deleteJobCardAndMaterials(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      toast.success('Job card deleted successfully');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete job card');
    },
  });
}
