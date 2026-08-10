import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { ProductionEntry } from '../model/types';
import { toast } from '../../../lib/logger';

export function useProductionEntriesQuery(jobCardId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['production-entries', jobCardId, orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchProductionEntries(jobCardId, orgId);
    },
    enabled: !!orgId,
  });
}

export function useOrgProductionEntriesQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-production-entries', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchProductionEntries(undefined, orgId);
    },
    enabled: !!orgId,
  });
}

export function useProductionEntryDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['production-entry-detail', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchProductionEntryById(id);
    },
    enabled: !!id,
  });
}

export function useCreateProductionEntryMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entry: Partial<ProductionEntry>;
      items: {
        job_card_material_id: string;
        material_id: string;
        issued_qty: number;
        consumed_qty: number;
        wastage_qty: number;
        return_qty: number;
      }[];
      orgId: string;
      userId: string;
      userEmail: string;
    }) => {
      return R.createProductionEntryAggregate(
        payload.entry,
        payload.items,
        payload.orgId,
        payload.userId,
        payload.userEmail
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['org-production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['job-card', variables.entry.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', variables.entry.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-dashboard'] });
      toast.success('Production entry logged');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create production entry');
    },
  });
}

export function useDeleteProductionEntryMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { entryId: string; orgId: string; userId: string; userEmail: string }) => {
      return R.deleteProductionEntryAggregate(payload.entryId, payload.orgId, payload.userId, payload.userEmail);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['org-production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-dashboard'] });
      toast.success('Production entry deleted');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete production entry');
    },
  });
}

export function useUpdateProductionEntryMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entryId: string;
      entryUpdates: Partial<ProductionEntry>;
      orgId: string;
      userId: string;
      userEmail: string;
    }) => {
      return R.updateProductionEntryAggregate(
        payload.entryId,
        payload.entryUpdates,
        payload.orgId,
        payload.userId,
        payload.userEmail
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['org-production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['job-card', variables.entryUpdates.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', variables.entryUpdates.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-dashboard'] });
      toast.success('Production entry updated');
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update production entry');
    },
  });
}

export function useActivityLogsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['activity-log', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchActivityLogs(orgId);
    },
    enabled: !!orgId,
  });
}
