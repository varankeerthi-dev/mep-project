import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import type { LedgerEntry, LedgerSummary, WorkOrderWithValue, LedgerEntryType } from '../types/subcontractor';

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

      // Build ledger entries
      // Balance represents: amount owed TO subcontractor (positive = we owe them)
      // WO-ISSUED = contract commitment (informational, doesn't affect payable balance)
      // INVOICE = subcontractor claims money (increases payable)
      // PAYMENT = we pay subcontractor (decreases payable)
      const ledger: LedgerEntry[] = [];
      let runningBalance = 0;

      // Add work order issuances (informational only, no balance impact)
      workOrders?.filter(wo => !wo.is_amendment).forEach(wo => {
        const amount = parseFloat(wo.total_amount || wo.contract_value) || 0;
        ledger.push({
          id: wo.id,
          date: wo.issue_date || wo.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: 'WO-ISSUED',
          reference: wo.work_order_no,
          workOrderRef: wo.work_order_no,
          description: wo.work_description,
          debit: amount,
          credit: 0,
          tdsAmount: 0,
          balance: runningBalance,
          details: wo
        });
      });

      // Add amendments (informational only, no balance impact)
      amendments?.forEach(amd => {
        const parentWO = workOrders?.find(wo => wo.id === amd.work_order_id);
        const difference = parseFloat(amd.difference_amount) || 0;
        ledger.push({
          id: amd.id,
          date: amd.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: 'WO-AMD',
          reference: `AMD-${String(amd.amendment_no).padStart(3, '0')}`,
          workOrderRef: parentWO?.work_order_no,
          description: amd.reason,
          debit: difference > 0 ? difference : 0,
          credit: difference < 0 ? Math.abs(difference) : 0,
          tdsAmount: 0,
          balance: runningBalance,
          details: amd
        });
      });

      // Add invoices (increases payable balance)
      invoices?.forEach(inv => {
        const amount = parseFloat(inv.amount) || 0;
        runningBalance += amount;
        const linkedWO = workOrders?.find(wo => wo.id === inv.work_order_id);
        ledger.push({
          id: inv.id,
          date: inv.invoice_date,
          type: 'INVOICE',
          reference: inv.invoice_no,
          workOrderRef: linkedWO?.work_order_no,
          description: `Invoice from subcontractor`,
          debit: amount,
          credit: 0,
          tdsAmount: 0,
          balance: runningBalance,
          details: inv
        });
      });

      // Add payments (decreases payable balance)
      let totalTDS = 0;
      payments?.forEach(pay => {
        const grossAmount = parseFloat(pay.gross_amount || pay.amount) || 0;
        const tdsAmount = parseFloat(pay.tds_amount) || 0;
        runningBalance -= grossAmount;
        totalTDS += tdsAmount;

        const linkedWO = workOrders?.find(wo => wo.id === pay.work_order_id);
        ledger.push({
          id: pay.id,
          date: pay.payment_date,
          type: 'PAYMENT',
          reference: pay.reference_no || `PAY-${pay.id.slice(0, 6)}`,
          workOrderRef: linkedWO?.work_order_no,
          description: pay.description || 'Payment to subcontractor',
          debit: 0,
          credit: grossAmount,
          tdsAmount: tdsAmount,
          balance: runningBalance,
          details: pay
        });
      });

      // Sort by date
      ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Recalculate balances after sorting
      let newBalance = 0;
      ledger.forEach(entry => {
        newBalance += entry.debit - entry.credit;
        entry.balance = newBalance;
      });

      // Calculate summary
      const summary: LedgerSummary = {
        contractValue: workOrders
          ?.filter(wo => !wo.is_amendment)
          .reduce((sum, wo) => sum + (parseFloat(wo.total_amount || wo.contract_value) || 0), 0) || 0,
        totalInvoiced: invoices?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0,
        totalPaid: payments?.reduce((sum, pay) => sum + (parseFloat(pay.gross_amount || pay.amount) || 0), 0) || 0,
        balanceDue: newBalance,
        totalTDS: totalTDS,
        totalRetention: 0,
        releasedRetention: 0
      };

      // Prepare work orders list with amendments
      const workOrdersWithAmendments: WorkOrderWithValue[] = workOrders?.map(wo => ({
        id: wo.id,
        work_order_no: wo.work_order_no,
        work_description: wo.work_description || '',
        total_amount: parseFloat(wo.total_amount || wo.contract_value) || 0,
        contract_value: parseFloat(wo.contract_value) || 0,
        status: wo.status,
        is_amendment: wo.is_amendment,
        amendment_no: wo.amendment_no,
        parent_work_order_id: wo.parent_work_order_id
      })) || [];

      return {
        workOrders: workOrdersWithAmendments,
        ledger,
        summary,
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
