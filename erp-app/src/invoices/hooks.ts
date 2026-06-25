import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import { withSessionCheck } from '../queryClient';
import {
  createInvoice,
  getInvoiceById,
  getInvoices,
  getInvoiceTemplates,
  updateInvoice,
  deleteInvoice,
  updateInvoiceSubmissionDetails,
  deleteInvoiceSubmissionDetails,
  type InvoiceFilters,
  type InvoiceWithRelations,
  type InvoiceTemplateRecord,
  type SubmissionUpdateInput,
} from './api';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  templates: () => [...invoiceKeys.all, 'templates'] as const,
};

export function useInvoices(filters: InvoiceFilters = {}) {
  const { organisation } = useAuth();
  const filtersWithOrg = { ...filters, organisationId: organisation?.id };

  return useQuery<InvoiceWithRelations[]>({
    queryKey: invoiceKeys.list(filtersWithOrg),
    queryFn: withSessionCheck(() => getInvoices(filtersWithOrg)),
    enabled: !!organisation?.id,
  });
}

export function useInvoice(id: string | null) {
  const { organisation } = useAuth();
  return useQuery<InvoiceWithRelations>({
    queryKey: invoiceKeys.detail(id || ''),
    queryFn: withSessionCheck(() => getInvoiceById(id!, organisation?.id!)),
    enabled: !!id && !!organisation?.id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: any) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createInvoice({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.setQueryData(invoiceKeys.detail(data.id!), data);
    },
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((input: any) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return updateInvoice(id, { ...input, organisation_id: organisation.id });
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.setQueryData(invoiceKeys.detail(id), data);
    },
  });
}

export function useUpdateInvoiceSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmissionUpdateInput) => updateInvoiceSubmissionDetails(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoiceId) });
    },
  });
}

export function useDeleteInvoiceSubmission() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: (invoiceId: string) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return deleteInvoiceSubmissionDetails(invoiceId, organisation.id);
    },
    onSuccess: (data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  return useMutation({
    mutationFn: withSessionCheck((id: string) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return deleteInvoice(id, organisation.id);
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useInvoiceTemplates() {
  const { organisation } = useAuth();
  return useQuery<InvoiceTemplateRecord[]>({
    queryKey: [...invoiceKeys.templates(), organisation?.id],
    queryFn: withSessionCheck(() => getInvoiceTemplates(organisation?.id)),
    enabled: !!organisation?.id,
  });
}
