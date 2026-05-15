import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import { withSessionCheck } from '../queryClient';
import {
  getCreditNotes,
  getCreditNoteById,
  createCreditNote,
  updateCreditNote,
  deleteCreditNote,
  generateNextCNNumber,
} from './api';
import type { CreditNoteFilters, CreditNote, CreditNoteItem } from './types';

export const creditNoteKeys = {
  all: ['credit-notes'] as const,
  lists: () => [...creditNoteKeys.all, 'list'] as const,
  list: (filters: CreditNoteFilters) => [...creditNoteKeys.lists(), filters] as const,
  details: () => [...creditNoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...creditNoteKeys.details(), id] as const,
  nextNumber: (orgId: string) => [...creditNoteKeys.all, 'next-no', orgId] as const,
};

export type UpdateCreditNoteMutationInput = {
  id: string;
  organisation_id: string;
  client_id: string;
  invoice_id?: string | null;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason?: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  items: (Omit<CreditNoteItem, 'id' | 'cn_id' | 'organisation_id' | 'created_at'> & { id?: string })[];
};

export function useCreditNotes(filters: CreditNoteFilters = {}) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: creditNoteKeys.list({ ...filters, organisationId: organisation?.id }),
    queryFn: withSessionCheck(() => getCreditNotes({ ...filters, organisationId: organisation?.id })),
    enabled: !!organisation?.id,
  });
}

export function useCreditNote(id?: string) {
  const { organisation } = useAuth();
  return useQuery<CreditNote | null>({
    queryKey: id ? creditNoteKeys.detail(id) : [...creditNoteKeys.details(), 'empty'],
    queryFn: withSessionCheck(() => getCreditNoteById(id!, organisation!.id)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((input: Parameters<typeof createCreditNote>[0]) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createCreditNote({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
    },
  });
}

export function useUpdateCreditNote() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation<CreditNote, Error, UpdateCreditNoteMutationInput>({
    mutationFn: withSessionCheck(async (input) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return updateCreditNote({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCreditNote() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((id: string) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return deleteCreditNote(id, organisation.id);
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
    },
  });
}

export function useNextCNNumber() {
  const { organisation } = useAuth();
  return useQuery<string>({
    queryKey: organisation?.id ? creditNoteKeys.nextNumber(organisation.id) : [...creditNoteKeys.all, 'next-no', 'empty'],
    queryFn: withSessionCheck(() => generateNextCNNumber(organisation!.id)),
    enabled: !!organisation?.id,
    staleTime: 0,
  });
}
