import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import { IPQCCheckpoint, IPQCInspection } from '../model/types';
import { toast } from '../../../lib/logger';

export function useIPQCCheckpointsQuery(bomId: string | undefined) {
  return useQuery({
    queryKey: ['ipqc-checkpoints', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      return P.fetchIPQCCheckpoints(bomId);
    },
    enabled: !!bomId
  });
}

export function useCreateIPQCCheckpointMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (checkpoint: Omit<IPQCCheckpoint, 'id' | 'created_at'>) => {
      return P.insertIPQCCheckpoint(checkpoint);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ipqc-checkpoints', data.bom_id] });
      toast.success('In-Process QC Checkpoint created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create checkpoint');
    }
  });
}

export function useDeleteIPQCCheckpointMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bomId }: { id: string; bomId: string }) => {
      await P.deleteIPQCCheckpoint(id);
      return { bomId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ipqc-checkpoints', data.bomId] });
      toast.success('In-Process QC Checkpoint removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove checkpoint');
    }
  });
}

export function useIPQCInspectionsQuery(jobCardId: string | undefined) {
  return useQuery({
    queryKey: ['ipqc-inspections', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      return P.fetchIPQCInspections(jobCardId);
    },
    enabled: !!jobCardId
  });
}

export function useCreateIPQCInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inspection: Omit<IPQCInspection, 'id' | 'created_at'>) => {
      return P.insertIPQCInspection(inspection);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ipqc-inspections', data.job_card_id] });
      toast.success('In-Process QC Check log recorded successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record check log');
    }
  });
}

export function useUpdateIPQCInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, result, remarks, jobCardId }: { id: string; result: 'passed' | 'failed' | 'conditional'; remarks?: string; jobCardId: string }) => {
      return P.updateIPQCInspection(id, result, remarks);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ipqc-inspections', data.job_card_id] });
      toast.success('In-Process QC status updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update QC status');
    }
  });
}
