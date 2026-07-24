import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../App';
import { subcontractorService } from '../services/subcontractorService';
import { calculateLedger } from '../domain/ledgerCalculator';

export function useSubcontractorLedger(subcontractorId: string | null) {
  const { organisation } = useAuth();
  const organisationId = organisation?.id || null;

  const workOrdersQuery = useQuery({
    queryKey: ['subcontractors-v2', 'ledger', 'workOrders', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getWorkOrders(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
  });

  const parentWorkOrderIds = (workOrdersQuery.data || []).map(wo => wo.id);

  const amendmentsQuery = useQuery({
    queryKey: ['subcontractors-v2', 'ledger', 'amendments', parentWorkOrderIds],
    queryFn: async () => {
      if (!organisationId || parentWorkOrderIds.length === 0) return [];
      return subcontractorService.getAmendments(parentWorkOrderIds, organisationId);
    },
    enabled: !!organisationId && parentWorkOrderIds.length > 0,
  });

  const invoicesQuery = useQuery({
    queryKey: ['subcontractors-v2', 'ledger', 'invoices', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getInvoices(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
  });

  const paymentsQuery = useQuery({
    queryKey: ['subcontractors-v2', 'ledger', 'payments', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId || !organisationId) return [];
      return subcontractorService.getPayments(subcontractorId, organisationId);
    },
    enabled: !!subcontractorId && !!organisationId,
  });

  const isLoading = 
    workOrdersQuery.isLoading || 
    amendmentsQuery.isLoading || 
    invoicesQuery.isLoading || 
    paymentsQuery.isLoading;

  const isError = 
    workOrdersQuery.isError || 
    amendmentsQuery.isError || 
    invoicesQuery.isError || 
    paymentsQuery.isError;

  const error = 
    workOrdersQuery.error || 
    amendmentsQuery.error || 
    invoicesQuery.error || 
    paymentsQuery.error;

  const data = !isLoading && !isError ? calculateLedger(
    workOrdersQuery.data || null,
    amendmentsQuery.data || null,
    invoicesQuery.data || null,
    paymentsQuery.data || null
  ) : null;

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: async () => {
      await workOrdersQuery.refetch();
      await amendmentsQuery.refetch();
      await invoicesQuery.refetch();
      await paymentsQuery.refetch();
    }
  };
}
