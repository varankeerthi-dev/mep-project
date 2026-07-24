import type { LedgerEntry, LedgerSummary, WorkOrderWithValue } from '../../../types/subcontractor';

export interface LedgerCalculationResult {
  workOrders: WorkOrderWithValue[];
  ledger: LedgerEntry[];
  summary: LedgerSummary;
}

// Deep freeze helper for dev/test builds
function deepFreeze<T extends object>(obj: T): T {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return obj;
  }
  
  Object.freeze(obj);
  
  Object.keys(obj).forEach((key) => {
    const prop = (obj as any)[key];
    if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  });
  
  return obj;
}

export function calculateLedger(
  workOrders: any[] | null,
  amendments: any[] | null,
  invoices: any[] | null,
  payments: any[] | null
): LedgerCalculationResult {
  const ledger: LedgerEntry[] = [];
  let runningBalance = 0;

  // 1. Add work order commitment entries (informational)
  workOrders?.filter(wo => !wo.is_amendment).forEach(wo => {
    const amount = parseFloat(wo.total_amount || wo.contract_value) || 0;
    ledger.push({
      id: wo.id,
      date: wo.issue_date || wo.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      type: 'WO-ISSUED',
      reference: wo.work_order_no,
      workOrderRef: wo.work_order_no,
      description: wo.work_description || '',
      debit: amount,
      credit: 0,
      tdsAmount: 0,
      balance: runningBalance,
      details: wo
    });
  });

  // 2. Add work order amendments (informational)
  amendments?.forEach(amd => {
    const parentWO = workOrders?.find(wo => wo.id === amd.work_order_id);
    const difference = parseFloat(amd.difference_amount) || 0;
    ledger.push({
      id: amd.id,
      date: amd.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      type: 'WO-AMD',
      reference: `AMD-${String(amd.amendment_no).padStart(3, '0')}`,
      workOrderRef: parentWO?.work_order_no || '',
      description: amd.reason || '',
      debit: difference > 0 ? difference : 0,
      credit: difference < 0 ? Math.abs(difference) : 0,
      tdsAmount: 0,
      balance: runningBalance,
      details: amd
    });
  });

  // 3. Add invoices (increases subcontractor's claim/payable balance)
  invoices?.forEach(inv => {
    const amount = parseFloat(inv.amount) || 0;
    runningBalance += amount;
    const linkedWO = workOrders?.find(wo => wo.id === inv.work_order_id);
    ledger.push({
      id: inv.id,
      date: inv.invoice_date,
      type: 'INVOICE',
      reference: inv.invoice_no,
      workOrderRef: linkedWO?.work_order_no || '',
      description: 'Invoice from subcontractor',
      debit: amount,
      credit: 0,
      tdsAmount: 0,
      balance: runningBalance,
      details: inv
    });
  });

  // 4. Add payments (decreases subcontractor's claim/payable balance)
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
      workOrderRef: linkedWO?.work_order_no || '',
      description: pay.description || 'Payment to subcontractor',
      debit: 0,
      credit: grossAmount,
      tdsAmount: tdsAmount,
      balance: runningBalance,
      details: pay
    });
  });

  // 5. Sort all transaction entries by date
  ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 6. Recalculate intermediate running balances chronologically
  let newBalance = 0;
  ledger.forEach(entry => {
    newBalance += entry.debit - entry.credit;
    entry.balance = newBalance;
  });

  // 7. Compile overall summary
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

  // 8. Prepare mapped work orders with stable types
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

  const result: LedgerCalculationResult = {
    workOrders: workOrdersWithAmendments,
    ledger,
    summary
  };

  // Apply dev/test deep freeze
  return deepFreeze(result);
}
