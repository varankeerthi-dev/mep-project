import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProformaFilters } from './types';
import type { ProformaInput } from './schemas';
import {
  getProformaInvoices,
  getProformaById,
  createProforma,
  updateProforma,
  sendProforma,
  markAccepted,
  markRejected,
  convertToInvoice,
  deleteProforma,
} from './api';

export function useProformaInvoices(filters: ProformaFilters = {}) {
  return useQuery({
    queryKey: ['proforma-invoices', filters],
    queryFn: () => getProformaInvoices(filters),
    enabled: !!filters.organisationId,
  });
}

export function useProformaById(id: string | null, organisationId?: string) {
  return useQuery({
    queryKey: ['proforma-invoice', id],
    queryFn: () => getProformaById(id!, organisationId),
    enabled: !!id,
  });
}

export function useCreateProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProformaInput & { organisation_id: string }) => createProforma(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
    },
  });
}

export function useUpdateProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProformaInput & { organisation_id: string } }) =>
      updateProforma(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['proforma-invoice', id] });
    },
  });
}

export function useSendProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, organisationId, validDays }: { id: string; organisationId: string; validDays?: number }) =>
      sendProforma(id, organisationId, validDays),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['proforma-invoice', id] });
    },
  });
}

export function useMarkAccepted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, organisationId }: { id: string; organisationId: string }) =>
      markAccepted(id, organisationId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['proforma-invoice', id] });
    },
  });
}

export function useMarkRejected() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, organisationId }: { id: string; organisationId: string }) =>
      markRejected(id, organisationId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['proforma-invoice', id] });
    },
  });
}

export function useConvertToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proformaId, organisationId }: { proformaId: string; organisationId: string }) =>
      convertToInvoice(proformaId, organisationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeleteProforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, organisationId }: { id: string; organisationId: string }) =>
      deleteProforma(id, organisationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proforma-invoices'] });
    },
  });
}