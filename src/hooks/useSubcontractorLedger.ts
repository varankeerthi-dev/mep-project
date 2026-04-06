import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type LedgerEntryType = 'WO-ISSUED' | 'WO-AMD' | 'INVOICE' | 'PAYMENT';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  reference: string;
  workOrderRef?: string;
  description?: string;
  debit: number;
  credit: number;
  tdsAmount: number;
  balance: number;
  details?: any;
}

export interface LedgerSummary {
  contractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  totalTDS: number;
}

export interface WorkOrderWithValue {
  id: string;
  work_order_no: string;
  work_description: string;
  total_amount: number;
  status: string;
  is_amendment: boolean;
  amendment_no: number;
  parent_work_order_id?: string;
}

export function useSubcontractorLedger(subcontractorId: string | null) {
  return useQuery({
    queryKey: ['subcontractor-ledger', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return { workOrders: [], ledger: [], summary: null };

      // Fetch all work orders for this subcontractor
      const { data: workOrders, error: woError } = await supabase
        .from('subcontractor_work_orders')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: true });

      if (woError) throw woError;

      // Fetch all amendments
      const { data: amendments, error: amdError } = await supabase
        .from('subcontractor_work_order_amendments')
        .select('*')
        .in('work_order_id', workOrders?.map(wo => wo.id) || [])
        .eq('status', 'Approved')
        .order('created_at', { ascending: true });

      if (amdError) throw amdError;

      // Fetch all invoices linked to these work orders
      const { data: invoices, error: invError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('invoice_date', { ascending: true });

      if (invError) throw invError;

      // Fetch all payments
      const { data: payments, error: payError } = await supabase
        .from('subcontractor_payments')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('payment_date', { ascending: true });

      if (payError) throw payError;

      // Build ledger entries
      const ledger: LedgerEntry[] = [];
      let runningBalance = 0;

      // Add work order issuances (parent WOs only)
      workOrders?.filter(wo => !wo.is_amendment).forEach(wo => {
        const amount = parseFloat(wo.total_amount) || 0;
        runningBalance += amount;
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

      // Add amendments
      amendments?.forEach(amd => {
        const parentWO = workOrders?.find(wo => wo.id === amd.work_order_id);
        const difference = parseFloat(amd.difference_amount) || 0;
        runningBalance += difference;
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

      // Add invoices
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

      // Add payments (gross amounts)
      let totalTDS = 0;
      payments?.forEach(pay => {
        const grossAmount = parseFloat(pay.gross_amount || pay.amount) || 0;
        const tdsAmount = parseFloat(pay.tds_amount) || 0;
        const netAmount = parseFloat(pay.net_amount || (grossAmount - tdsAmount)) || 0;
        
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
          .reduce((sum, wo) => sum + (parseFloat(wo.total_amount) || 0), 0) || 0,
        totalInvoiced: invoices?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0,
        totalPaid: payments?.reduce((sum, pay) => sum + (parseFloat(pay.gross_amount || pay.amount) || 0), 0) || 0,
        balanceDue: newBalance,
        totalTDS: totalTDS
      };

      // Prepare work orders list with amendments
      const workOrdersWithAmendments: WorkOrderWithValue[] = workOrders?.map(wo => ({
        id: wo.id,
        work_order_no: wo.work_order_no,
        work_description: wo.work_description,
        total_amount: parseFloat(wo.total_amount) || 0,
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
    enabled: !!subcontractorId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function usePendingAmendments(subcontractorId: string | null) {
  return useQuery({
    queryKey: ['subcontractor-amendments-pending', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return [];

      const { data, error } = await supabase
        .from('subcontractor_work_order_amendments')
        .select(`
          *,
          subcontractor_work_orders!inner(subcontractor_id, work_order_no)
        `)
        .eq('subcontractor_work_orders.subcontractor_id', subcontractorId)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId,
    staleTime: 30 * 1000 // 30 seconds
  });
}

export function useTDSPayments(subcontractorId: string | null) {
  return useQuery({
    queryKey: ['subcontractor-tds-payments', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return [];

      const { data, error } = await supabase
        .from('subcontractor_tds_payments')
        .select(`
          *,
          subcontractor_payments(gross_amount, tds_amount)
        `)
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId,
    staleTime: 5 * 60 * 1000
  });
}
