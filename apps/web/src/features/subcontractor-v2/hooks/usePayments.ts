import { useQuery } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from './queryKeys';

export function usePayments(subcontractorId: string | null, organisationId: string | null) {
  const query = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.payments(subcontractorId),
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getPayments(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    payments: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
