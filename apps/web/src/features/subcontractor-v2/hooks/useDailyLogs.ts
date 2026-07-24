import { useQuery } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from './queryKeys';

export function useDailyLogs(subcontractorId: string | null, organisationId: string | null) {
  const dailyLogsQuery = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.dailyLogs(subcontractorId),
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getDailyLogs(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
    staleTime: 2 * 60 * 1000,
  });

  const manpowerAttendanceQuery = useQuery({
    queryKey: ['subcontractors-v2', 'manpowerAttendance', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return [];
      return subcontractorService.getManpowerAttendance(subcontractorId);
    },
    enabled: !!subcontractorId,
    staleTime: 2 * 60 * 1000,
  });

  const labourCategoriesQuery = useQuery({
    queryKey: ['subcontractors-v2', 'labourCategories', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      return subcontractorService.getLabourCategories(organisationId);
    },
    enabled: !!organisationId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    dailyLogs: dailyLogsQuery.data || [],
    manpowerAttendance: manpowerAttendanceQuery.data || [],
    labourCategories: labourCategoriesQuery.data || [],
    isLoading: dailyLogsQuery.isLoading || manpowerAttendanceQuery.isLoading || labourCategoriesQuery.isLoading,
    isError: dailyLogsQuery.isError || manpowerAttendanceQuery.isError || labourCategoriesQuery.isError,
    refetch: async () => {
      await dailyLogsQuery.refetch();
      await manpowerAttendanceQuery.refetch();
      await labourCategoriesQuery.refetch();
    }
  };
}
