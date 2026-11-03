import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { sitePlanApi } from '../api/sitePlanApi';
import type { SitePlan, SitePlanAllocation } from '../types';

export function useSitePlans(options?: { startDate?: string; endDate?: string }) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery({
    queryKey: ['site_plans', orgId, options?.startDate, options?.endDate],
    queryFn: () => (orgId ? sitePlanApi.getSitePlans(orgId, options) : Promise.resolve([])),
    enabled: !!orgId,
  });
}

export function useSitePlan(id: string | null) {
  return useQuery({
    queryKey: ['site_plan', id],
    queryFn: () => (id ? sitePlanApi.getSitePlanById(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useCreateSitePlan() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: (planData: Partial<SitePlan>) => {
      if (!organisation?.id) throw new Error('No organisation selected');
      return sitePlanApi.createSitePlan({
        ...planData,
        organisation_id: organisation.id,
        created_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useUpdateSitePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SitePlan> }) =>
      sitePlanApi.updateSitePlan(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['site_plan', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useRescheduleSitePlan() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: ({
      planId,
      previousDate,
      newDate,
      reason,
      clientAgreed,
    }: {
      planId: string;
      previousDate: string;
      newDate: string;
      reason: string;
      clientAgreed: boolean;
    }) => {
      if (!organisation?.id) throw new Error('No organisation selected');
      return sitePlanApi.rescheduleSitePlan({
        planId,
        organisationId: organisation.id,
        previousDate,
        newDate,
        reason,
        clientAgreed,
        userId: user?.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['site_plan', variables.planId] });
      queryClient.invalidateQueries({ queryKey: ['schedule_history', variables.planId] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useAddAllocation() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: (allocation: Partial<SitePlanAllocation>) => {
      if (!organisation?.id) throw new Error('No organisation selected');
      return sitePlanApi.addAllocation({
        ...allocation,
        organisation_id: organisation.id,
        allocated_by: user?.id || null,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['site_plan', variables.site_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useRemoveAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ allocationId, planId }: { allocationId: string; planId: string }) =>
      sitePlanApi.removeAllocation(allocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useDispatchExecutionVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => sitePlanApi.dispatchExecutionVisit(planId),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ['site_plans'] });
      queryClient.invalidateQueries({ queryKey: ['site_plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['site_visits'] });
      queryClient.invalidateQueries({ queryKey: ['tomorrows_summary'] });
    },
  });
}

export function useScheduleHistory(planId: string | null) {
  return useQuery({
    queryKey: ['schedule_history', planId],
    queryFn: () => (planId ? sitePlanApi.getScheduleHistory(planId) : Promise.resolve([])),
    enabled: !!planId,
  });
}

export function useTomorrowsSummary(dateStr: string) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery({
    queryKey: ['tomorrows_summary', orgId, dateStr],
    queryFn: () => (orgId ? sitePlanApi.getTomorrowsSummary(orgId, dateStr) : null),
    enabled: !!orgId,
  });
}
