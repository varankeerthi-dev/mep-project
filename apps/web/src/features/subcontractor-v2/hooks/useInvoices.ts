import { useQuery } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from './queryKeys';

export function useInvoices(subcontractorId: string | null, organisationId: string | null) {
  const query = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.invoices(subcontractorId),
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getInvoices(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    invoices: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
