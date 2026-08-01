import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import { WorkCenter, BomWorkCenter } from '../model/types';
import { toast } from '../../../lib/logger';

export function useWorkCentersQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['work-centers', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchWorkCenters(orgId);
    },
    enabled: !!orgId
  });
}

export function useWorkCenterDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['work-center', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchWorkCenterById(id);
    },
    enabled: !!id
  });
}

export function useCreateWorkCenterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (wc: Omit<WorkCenter, 'id' | 'created_at' | 'updated_at'>) => {
      return P.insertWorkCenter(wc);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-centers', data.organisation_id] });
      toast.success('Work Center created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create work center');
    }
  });
}

export function useBomWorkCentersQuery(bomId: string | undefined) {
  return useQuery({
    queryKey: ['bom-work-centers', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      return P.fetchBomWorkCenters(bomId);
    },
    enabled: !!bomId
  });
}

export function useInsertBomWorkCenterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: Omit<BomWorkCenter, 'id' | 'created_at'>) => {
      return P.insertBomWorkCenter(mapping);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bom-work-centers', data.bom_id] });
      toast.success('Work center linked to BOM successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to link work center to BOM');
    }
  });
}

export function useDeleteBomWorkCenterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bomId }: { id: string; bomId: string }) => {
      await P.deleteBomWorkCenter(id);
      return { bomId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bom-work-centers', data.bomId] });
      toast.success('Work center link removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove work center link');
    }
  });
}
