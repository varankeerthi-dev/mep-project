import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import {
  createInvoice,
  getInvoiceById,
  getInvoices,
  getInvoiceTemplates,
  updateInvoice,
  type InvoiceTemplateRecord,
  type InvoiceWithRelations,
} from './api';
import type { InvoiceFilters } from './types';
import type { InvoiceInput } from './schemas';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters = {}) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  templates: () => [...invoiceKeys.all, 'templates'] as const,
};

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvoiceInput) => createInvoice(input),
    onSuccess: (invoice: InvoiceWithRelations) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.setQueryData(invoiceKeys.detail(invoice.id!), invoice);
    },
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvoiceInput) => updateInvoice(id, input),
    onSuccess: (invoice: InvoiceWithRelations) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.setQueryData(invoiceKeys.detail(id), invoice);
    },
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: id ? invoiceKeys.detail(id) : [...invoiceKeys.details(), 'empty'],
    queryFn: () => getInvoiceById(id as string),
    enabled: Boolean(id),
  });
}

export function useInvoices(filters: InvoiceFilters = {}) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.list({ ...filters, organisationId: organisation?.id }),
    queryFn: () => getInvoices({ ...filters, organisationId: organisation?.id }),
    enabled: !!organisation?.id,
  });
}

export function useInvoiceTemplates() {
  return useQuery<InvoiceTemplateRecord[]>({
    queryKey: invoiceKeys.templates(),
    queryFn: getInvoiceTemplates,
    staleTime: 5 * 60 * 1000,
  });
}
