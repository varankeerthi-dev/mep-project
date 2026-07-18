import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { withSessionCheck } from '../../../queryClient';
import { QUERY_KEYS } from '../constants';
import {
  listBOQs, getBOQById, createBOQ, updateBOQ, deleteBOQ,
  listSections, createSection, updateSection, deleteSection,
  listItems, listAllItems, createItem, createItems, updateItem, deleteItem,
  type BOQFilterParams,
} from '../api/boq';
import type { BOQHeaderInput, BOQSectionInput, BOQItemInput } from '../model';

export const boqKeys = {
  all: [QUERY_KEYS.boqs] as const,
  lists: () => [...boqKeys.all, 'list'] as const,
  list: (filters: BOQFilterParams) => [...boqKeys.lists(), filters] as const,
  details: () => [...boqKeys.all, 'detail'] as const,
  detail: (id: string) => [...boqKeys.details(), id] as const,
  sections: (boqId: string) => [...boqKeys.all, 'sections', boqId] as const,
  items: (sectionId: string) => [...boqKeys.all, 'items', sectionId] as const,
  allItems: (boqId: string) => [...boqKeys.all, 'allItems', boqId] as const,
};

export function useBOQs(filters: BOQFilterParams) {
  const { organisation } = useAuth();
  const filtersWithOrg = { ...filters, organisation_id: organisation?.id || filters.organisation_id };

  return useQuery({
    queryKey: boqKeys.list(filtersWithOrg),
    queryFn: withSessionCheck(() => listBOQs(filtersWithOrg)),
    enabled: !!organisation?.id,
  });
}

export function useBOQ(id: string | null) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: boqKeys.detail(id || ''),
    queryFn: withSessionCheck(() => getBOQById(id!)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreateBOQ() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: BOQHeaderInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createBOQ({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.lists() });
      queryClient.setQueryData(boqKeys.detail(data.id!), data);
    },
  });
}

export function useUpdateBOQ(id: string) {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: Partial<BOQHeaderInput>) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return updateBOQ(id, input);
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.lists() });
      queryClient.setQueryData(boqKeys.detail(id), data);
    },
  });
}

export function useDeleteBOQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((id: string) => deleteBOQ(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boqKeys.lists() });
    },
  });
}

export function useSections(boqId: string | null) {
  return useQuery({
    queryKey: boqKeys.sections(boqId || ''),
    queryFn: withSessionCheck(() => listSections(boqId!)),
    enabled: !!boqId,
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: BOQSectionInput) => createSection(input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.sections(data.boq_id) });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, input }: { id: string; input: Partial<BOQSectionInput> }) => updateSection(id, input)),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.sections(data?.boq_id || variables.input.boq_id || '') });
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, boqId }: { id: string; boqId: string }) => deleteSection(id)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.sections(variables.boqId) });
    },
  });
}

export function useItems(sectionId: string | null) {
  return useQuery({
    queryKey: boqKeys.items(sectionId || ''),
    queryFn: withSessionCheck(() => listItems(sectionId!)),
    enabled: !!sectionId,
  });
}

export function useAllItems(boqId: string | null) {
  return useQuery({
    queryKey: boqKeys.allItems(boqId || ''),
    queryFn: withSessionCheck(() => listAllItems(boqId!)),
    enabled: !!boqId,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((input: BOQItemInput) => createItem(input)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.items(data.section_id) });
      queryClient.invalidateQueries({ queryKey: [...boqKeys.all, 'allItems'] });
    },
  });
}

export function useCreateItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ inputs, boqId }: { inputs: BOQItemInput[]; boqId: string }) => createItems(inputs)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.allItems(variables.boqId) });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, input }: { id: string; input: Partial<BOQItemInput> }) => updateItem(id, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.boqs, 'items'] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(({ id, sectionId }: { id: string; sectionId: string }) => deleteItem(id)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: boqKeys.items(variables.sectionId) });
    },
  });
}
