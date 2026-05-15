import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import { withSessionCheck } from '../queryClient';
import {
  createReceipt,
  updateReceipt,
  deleteReceipt,
  refundReceipt,
  getPaymentsByInvoiceId,
  generateNextReceiptNo,
  type ReceiptInput,
  type UpdateReceiptInput,
  type LedgerReceipt,
} from './api';

export const paymentKeys = {
  all: ['payments'] as const,
  byInvoice: (invoiceId: string) => [...paymentKeys.all, 'invoice', invoiceId] as const,
  nextReceiptNo: (orgId: string) => [...paymentKeys.all, 'next-no', orgId] as const,
};

export function useInvoicePayments(invoiceId?: string) {
  const { organisation } = useAuth();
  return useQuery<LedgerReceipt[]>({
    queryKey: invoiceId ? paymentKeys.byInvoice(invoiceId) : [...paymentKeys.all, 'empty'],
    queryFn: withSessionCheck(async () => {
      if (!invoiceId || !organisation?.id) return [];
      return getPaymentsByInvoiceId(invoiceId, organisation.id);
    }),
    enabled: !!invoiceId && !!organisation?.id,
  });
}

export function useNextReceiptNo() {
  const { organisation } = useAuth();
  return useQuery<string>({
    queryKey: organisation?.id ? paymentKeys.nextReceiptNo(organisation.id) : [...paymentKeys.all, 'next-no', 'empty'],
    queryFn: withSessionCheck(() => generateNextReceiptNo(organisation!.id)),
    enabled: !!organisation?.id,
    staleTime: 0,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((input: Omit<ReceiptInput, 'org_id'>) => {
      if (!organisation?.id) throw new Error('Not authenticated');
      return createReceipt({ ...input, org_id: organisation.id });
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck((input: UpdateReceiptInput) => updateReceipt(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck((id: string) => deleteReceipt(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck((id: string) => refundReceipt(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}
