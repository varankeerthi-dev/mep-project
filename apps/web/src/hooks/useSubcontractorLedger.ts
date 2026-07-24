import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import type { LedgerEntry, LedgerSummary, WorkOrderWithValue, LedgerEntryType } from '../types/subcontractor';
import { calculateLedger } from '../features/subcontractor/domain/ledgerCalculator';

export type { LedgerEntry, LedgerSummary, WorkOrderWithValue, LedgerEntryType };

export function useSubcontractorLedger(subcontractorId: string | null) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['subcontractor-ledger', subcontractorId, organisation?.id],
    queryFn: async () => {
      if (!subcontractorId || !organisation?.id) return { workOrders: [], ledger: [], summary: null };

      // Fetch all work orders for this subcontractor
      const { data: workOrders, error: woError } = await supabase
        .from('subcontractor_work_orders')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: true });

      if (woError) throw woError;

      // Fetch all amendments
      const { data: amendments, error: amdError } = await supabase
        .from('subcontractor_work_order_amendments')
        .select('*')
        .in('work_order_id', workOrders?.map(wo => wo.id) || [])
        .eq('organisation_id', organisation.id)
        .eq('status', 'Approved')
        .order('created_at', { ascending: true });

      if (amdError) throw amdError;

      // Fetch all invoices linked to these work orders
      const { data: invoices, error: invError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .eq('organisation_id', organisation.id)
        .order('invoice_date', { ascending: true });

      if (invError) throw invError;

      // Fetch all payments
      const { data: payments, error: payError } = await supabase
        .from('subcontractor_payments')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .eq('organisation_id', organisation.id)
        .order('payment_date', { ascending: true });

      if (payError) throw payError;

      const calculationResult = calculateLedger(workOrders, amendments, invoices, payments);

      return {
        ...calculationResult,
        rawData: { workOrders, amendments, invoices, payments }
      };
    },
    enabled: !!subcontractorId && !!organisation?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function usePendingAmendments(subcontractorId: string | null) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['subcontractor-amendments-pending', subcontractorId, organisation?.id],
    queryFn: async () => {
      if (!subcontractorId || !organisation?.id) return [];

      const { data, error } = await supabase
        .from('subcontractor_work_order_amendments')
        .select(`
          *,
          subcontractor_work_orders!inner(subcontractor_id, work_order_no)
        `)
        .eq('subcontractor_work_orders.subcontractor_id', subcontractorId)
        .eq('organisation_id', organisation.id)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId && !!organisation?.id,
    staleTime: 30 * 1000 // 30 seconds
  });
}

export function useTDSPayments(subcontractorId: string | null) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['subcontractor-tds-payments', subcontractorId, organisation?.id],
    queryFn: async () => {
      if (!subcontractorId || !organisation?.id) return [];

      const { data, error } = await supabase
        .from('subcontractor_tds_payments')
        .select(`
          *,
          subcontractor_payments(gross_amount, tds_amount)
        `)
        .eq('subcontractor_id', subcontractorId)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId && !!organisation?.id,
    staleTime: 5 * 60 * 1000
  });
}
