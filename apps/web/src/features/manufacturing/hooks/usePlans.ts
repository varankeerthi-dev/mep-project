import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as P from '../persistence';
import * as R from '../repository';
import { ProductionPlan, ProductionPlanItem } from '../model/types';
import { toast } from '../../../lib/logger';

export function useDemandRequirementsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['demand-requirements', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return R.fetchDemandRequirements(orgId);
    },
    enabled: !!orgId
  });
}

export function useProductionPlansQuery(orgId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['production-plans', orgId, status],
    queryFn: async () => {
      if (!orgId) return [];
      return P.fetchProductionPlans(orgId, status);
    },
    enabled: !!orgId
  });
}

export function useProductionPlanDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['production-plan', id],
    queryFn: async () => {
      if (!id) return null;
      return P.fetchProductionPlanById(id);
    },
    enabled: !!id
  });
}

export function useProductionPlanItemsQuery(planId: string | undefined) {
  return useQuery({
    queryKey: ['production-plan-items', planId],
    queryFn: async () => {
      if (!planId) return [];
      return P.fetchProductionPlanItems(planId);
    },
    enabled: !!planId
  });
}

export function useCreateProductionPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      plan,
      items,
      orgId,
      userId
    }: {
      plan: Omit<ProductionPlan, 'id' | 'plan_no' | 'created_at' | 'updated_at'>;
      items: Omit<ProductionPlanItem, 'id' | 'plan_id' | 'created_at'>[];
      orgId: string;
      userId: string;
    }) => {
      return R.createProductionPlanAggregate(plan, items, orgId, userId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-plans', data.plan.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['demand-requirements', data.plan.organisation_id] });
      toast.success(`Production Plan ${data.plan.plan_no} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create production plan');
    }
  });
}

export function useConvertPlanToJobCardsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      itemIds,
      orgId,
      userId
    }: {
      planId: string;
      itemIds: string[];
      orgId: string;
      userId: string;
    }) => {
      return R.convertPlanToJobCardsAggregate(planId, itemIds, orgId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-plans', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['production-plan', variables.planId] });
      queryClient.invalidateQueries({ queryKey: ['production-plan-items', variables.planId] });
      queryClient.invalidateQueries({ queryKey: ['job-cards', variables.orgId] });
      toast.success('Production plan items successfully converted to Job Cards!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to convert plan items to Job Cards');
    }
  });
}
