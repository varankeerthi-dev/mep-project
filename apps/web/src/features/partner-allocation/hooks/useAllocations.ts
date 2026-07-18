import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { withSessionCheck } from '../../../queryClient';
import {
  listAllocations, getAllocationById, createAllocation, updateAllocation, deleteAllocation, getAllocationsByLeadId,
  type AllocationFilterParams,
} from '../api/allocations';
import type { LeadAllocationInput } from '../model';

export const QUERY_KEY = 'partner-allocation.allocations';

export const allocationKeys = {
  all: [QUERY_KEY] as const,
  lists: () => [...allocationKeys.all, 'list'] as const,
  list: (filters: AllocationFilterParams) => [...allocationKeys.lists(), filters] as const,
  details: () => [...allocationKeys.all, 'detail'] as const,
  detail: (id: string) => [...allocationKeys.details(), id] as const,
  byLead: (leadId: string) => [...allocationKeys.all, 'byLead', leadId] as const,
};

export function useAllocations(filters: AllocationFilterParams) {
  const { organisation } = useAuth();
  const filtersWithOrg = { ...filters, organisation_id: organisation?.id || filters.organisation_id };

  return useQuery({
    queryKey: allocationKeys.list(filtersWithOrg),
    queryFn: withSessionCheck(() => listAllocations(filtersWithOrg)),
    enabled: !!organisation?.id,
  });
}

export function useAllocation(id: string | null) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: allocationKeys.detail(id || ''),
    queryFn: withSessionCheck(() => getAllocationById(id!)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreateAllocation() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: LeadAllocationInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createAllocation({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: allocationKeys.lists() });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: allocationKeys.byLead(data.lead_id) });
      }
    },
  });
}

export function useUpdateAllocation(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: Partial<LeadAllocationInput>) => {
      if (!id) throw new Error('Allocation ID required');
      return updateAllocation(id, input);
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: allocationKeys.lists() });
      if (id) queryClient.setQueryData(allocationKeys.detail(id), data);
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: allocationKeys.byLead(data.lead_id) });
      }
    },
  });
}

export function useUpdateAllocationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ allocationId, status, partner_notes }: { allocationId: string; status: string; partner_notes?: string }) => {
      const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
      if (status === 'Accepted' || status === 'Rejected') update.responded_at = new Date().toISOString();
      if (status === 'Completed') update.completed_at = new Date().toISOString();
      if (partner_notes) update.partner_notes = partner_notes;
      return updateAllocation(allocationId, update as any);
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allocationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((id: string) => deleteAllocation(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allocationKeys.lists() });
    },
  });
}

export function useAllocationsByLead(leadId: string | null) {
  return useQuery({
    queryKey: allocationKeys.byLead(leadId || ''),
    queryFn: withSessionCheck(() => getAllocationsByLeadId(leadId!)),
    enabled: !!leadId,
  });
}
