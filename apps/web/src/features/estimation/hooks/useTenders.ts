import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { withSessionCheck } from '../../../queryClient';
import { QUERY_KEYS } from '../constants';
import {
  listTenders, getTenderById, createTender, updateTender, deleteTender,
  listTenderHistory, createTenderDocument, deleteTenderDocument,
  type TenderFilterParams,
} from '../api/tenders';
import type { TenderInput, TenderDocumentInput } from '../model';

export const tenderKeys = {
  all: [QUERY_KEYS.tenders] as const,
  lists: () => [...tenderKeys.all, 'list'] as const,
  list: (filters: TenderFilterParams) => [...tenderKeys.lists(), filters] as const,
  details: () => [...tenderKeys.all, 'detail'] as const,
  detail: (id: string) => [...tenderKeys.details(), id] as const,
  history: () => [...tenderKeys.all, 'history'] as const,
};

export function useTenders(filters: TenderFilterParams) {
  const { organisation } = useAuth();
  const filtersWithOrg = { ...filters, organisation_id: organisation?.id || filters.organisation_id };

  return useQuery({
    queryKey: tenderKeys.list(filtersWithOrg),
    queryFn: withSessionCheck(() => listTenders(filtersWithOrg)),
    enabled: !!organisation?.id,
  });
}

export function useTender(id: string | null) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: tenderKeys.detail(id || ''),
    queryFn: withSessionCheck(() => getTenderById(id!)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreateTender() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: TenderInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createTender({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.lists() });
      queryClient.setQueryData(tenderKeys.detail(data.id!), data);
    },
  });
}

export function useUpdateTender(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: Partial<TenderInput>) => updateTender(id, input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.lists() });
      queryClient.setQueryData(tenderKeys.detail(id), data);
    },
  });
}

export function useDeleteTender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((id: string) => deleteTender(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.lists() });
    },
  });
}

export function useTenderHistory() {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: [...tenderKeys.history(), organisation?.id],
    queryFn: withSessionCheck(() => {
      if (!organisation?.id) return [];
      return listTenderHistory(organisation.id);
    }),
    enabled: !!organisation?.id,
  });
}

export function useCreateTenderDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: TenderDocumentInput) => createTenderDocument(input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.detail(data.tender_id) });
    },
  });
}

export function useDeleteTenderDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, tenderId }: { id: string; tenderId: string }) => deleteTenderDocument(id)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenderKeys.detail(variables.tenderId) });
    },
  });
}
