import { useQuery } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from './queryKeys';

export function useWorkOrders(subcontractorId: string | null, organisationId: string | null) {
  const workOrdersQuery = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.workOrders(subcontractorId),
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getWorkOrders(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
    staleTime: 2 * 60 * 1000,
  });

  const workOrders = workOrdersQuery.data || [];
  const parentWorkOrderIds = workOrders.map(wo => wo.id);

  const amendmentsQuery = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.amendments(parentWorkOrderIds),
    queryFn: async () => {
      if (!organisationId || parentWorkOrderIds.length === 0) return [];
      return subcontractorService.getAmendments(parentWorkOrderIds, organisationId);
    },
    enabled: !!organisationId && parentWorkOrderIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return {
    workOrders,
    amendments: amendmentsQuery.data || [],
    isLoading: workOrdersQuery.isLoading || amendmentsQuery.isLoading,
    isError: workOrdersQuery.isError || amendmentsQuery.isError,
    refetch: async () => {
      await workOrdersQuery.refetch();
      await amendmentsQuery.refetch();
    }
  };
}
