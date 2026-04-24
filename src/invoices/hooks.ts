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
  type InvoiceTemplateRecord,
  type InvoiceWithRelations,
} from './api';
import type { InvoiceFilters } from './types';
import type { InvoiceInput } from './schemas';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters = {}) => [...invoiceKeys.lists(), filters],
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string, orgId?: string) => [...invoiceKeys.details(), id, orgId].filter(Boolean),
  templates: () => [...invoiceKeys.all, 'templates'] as const,
};

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((input: InvoiceInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createInvoice({ ...input, organisation_id: organisation.id });
    }),
    onSuccess: (invoice: InvoiceWithRelations) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.setQueryData(invoiceKeys.detail(invoice.id!, organisation?.id), invoice);
    },
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((input: InvoiceInput) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return updateInvoice(id, { ...input, organisation_id: organisation.id });
    }),
    onSuccess: (invoice: InvoiceWithRelations) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.setQueryData(invoiceKeys.detail(id, organisation?.id), invoice);
    },
  });
}

export function useInvoice(id?: string) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: id ? invoiceKeys.detail(id, organisation?.id) : [...invoiceKeys.details(), 'empty'],
    queryFn: withSessionCheck(() => getInvoiceById(id as string, organisation?.id)),
    enabled: Boolean(id) && !!organisation?.id,
  });
}

export function useInvoices(filters: InvoiceFilters = {}) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.list({ ...filters, organisationId: organisation?.id }),
    queryFn: withSessionCheck(() => getInvoices({ ...filters, organisationId: organisation?.id })),
    enabled: !!organisation?.id,
  });
}

export function useInvoiceTemplates() {
  const { organisation } = useAuth();
  return useQuery<InvoiceTemplateRecord[]>({
    queryKey: [...invoiceKeys.templates(), organisation?.id],
    queryFn: withSessionCheck(() => getInvoiceTemplates(organisation?.id)),
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
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

