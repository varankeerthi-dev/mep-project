import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { QCParameter, FGQCInspection, QCParameterResult } from '../model/types';
import { toast } from '../../../lib/logger';

export function useQCInspectionsListQuery(orgId: string | undefined, result?: string) {
  return useQuery({
    queryKey: ['qc-inspections', orgId, result],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchQCInspections(orgId, result);
    },
    enabled: !!orgId,
  });
}

export function useQCInspectionDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['qc-inspection', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchQCInspectionById(id);
    },
    enabled: !!id,
  });
}

export function useQCParametersQuery(orgId: string | undefined, productId?: string, bomId?: string) {
  return useQuery({
    queryKey: ['qc-parameters', orgId, productId, bomId],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchQCParameters(orgId, productId, bomId);
    },
    enabled: !!orgId,
  });
}

export function useQCParameterResultsQuery(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ['qc-parameter-results', inspectionId],
    queryFn: async () => {
      if (!inspectionId) return [];
      return P.fetchQCParameterResults(inspectionId);
    },
    enabled: !!inspectionId,
  });
}

export function useCreateQCParameterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      param,
    }: {
      param: Omit<QCParameter, 'id' | 'created_at' | 'updated_at'>;
    }) => {
      return P.insertQCParameter(param);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-parameters', data.organisation_id] });
      toast.success('QC Parameter created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create QC Parameter');
    },
  });
}

export function useCreateFGQCInspectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inspection,
      results,
      orgId,
      userId,
      userName,
    }: {
      inspection: Omit<FGQCInspection, 'id' | 'inspection_no' | 'created_at' | 'updated_at'>;
      results: Omit<QCParameterResult, 'id' | 'inspection_id' | 'created_at'>[];
      orgId: string;
      userId: string;
      userName: string;
    }) => {
      return R.createFGQCInspectionAggregate(inspection, results, orgId, userId, userName);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-inspections', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['production-entries'] });
      queryClient.invalidateQueries({ queryKey: ['item-stocks'] });
      toast.success(`Quality inspection ${data.inspection_no} recorded successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record quality inspection');
    },
  });
}
