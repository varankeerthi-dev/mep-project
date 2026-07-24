import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from './queryKeys';

export function useSubcontractor(subcontractorId: string | null, organisationId: string | null) {
  const queryClient = useQueryClient();

  const detailsQuery = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.detail(subcontractorId),
    queryFn: () => {
      if (!subcontractorId) return null;
      return subcontractorService.getSubcontractor(subcontractorId);
    },
    enabled: !!subcontractorId,
    staleTime: 2 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: ({ payload, editMode }: { payload: any; editMode: boolean }) => {
      return subcontractorService.saveSubcontractor(payload, editMode, subcontractorId || undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.all() });
      if (subcontractorId) {
        queryClient.invalidateQueries({ queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.detail(subcontractorId) });
      }
    },
  });

  return {
    subcontractor: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isError: detailsQuery.isError,
    error: detailsQuery.error,
    refetch: detailsQuery.refetch,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
}
