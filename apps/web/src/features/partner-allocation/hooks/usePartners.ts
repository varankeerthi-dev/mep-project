import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { withSessionCheck } from '../../../queryClient';
import {
  listPartners, getPartnerById, createPartner, updatePartner, deletePartner,
  type PartnerFilterParams,
} from '../api/partners';
import type { PartnerInput } from '../model';

export const QUERY_KEY = 'partner-allocation.partners';

export const partnerKeys = {
  all: [QUERY_KEY] as const,
  lists: () => [...partnerKeys.all, 'list'] as const,
  list: (filters: PartnerFilterParams) => [...partnerKeys.lists(), filters] as const,
  details: () => [...partnerKeys.all, 'detail'] as const,
  detail: (id: string) => [...partnerKeys.details(), id] as const,
};

export function usePartners(filters: PartnerFilterParams) {
  const { organisation } = useAuth();
  const filtersWithOrg = { ...filters, organisation_id: organisation?.id || filters.organisation_id };

  return useQuery({
    queryKey: partnerKeys.list(filtersWithOrg),
    queryFn: withSessionCheck(() => listPartners(filtersWithOrg)),
    enabled: !!organisation?.id,
  });
}

export function usePartner(id: string | null) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: partnerKeys.detail(id || ''),
    queryFn: withSessionCheck(() => getPartnerById(id!)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: PartnerInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createPartner({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.lists() });
    },
  });
}

export function useUpdatePartner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: Partial<PartnerInput>) => updatePartner(id, input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.lists() });
      queryClient.setQueryData(partnerKeys.detail(id), data);
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((id: string) => deletePartner(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.lists() });
    },
  });
}
