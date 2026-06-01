import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type ProjectPO = {
  id: string;
  project_id: string | null;
  po_number: string;
  po_date: string | null;
  po_total_value: number | null;
  po_utilized_value: number | null;
  po_available_value: number | null;
  status: string | null;
  client_id: string | null;
  remarks: string | null;
};

export type ProjectInvoice = {
  id: string;
  project_id: string;
  po_id: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  status: string | null;
  remarks: string | null;
};

export type POUtilization = {
  po: ProjectPO;
  invoiced: number;
  available: number;
  utilizationPct: number;
  overInvoiced: boolean;
  invoices: ProjectInvoice[];
};

export type ProjectTransactionSummary = {
  totalPOValue: number;
  totalInvoiced: number;
  invoicedLinkedToPO: number;
  invoicedWithoutPO: number;
  totalUtilized: number;
  totalAvailable: number;
  poBalance: number;
  perPO: POUtilization[];
  unlinkedInvoices: ProjectInvoice[];
};

export type ProjectTransactions = {
  pos: ProjectPO[];
  invoices: ProjectInvoice[];
};

export const projectTransactionKeys = {
  detail: (projectId: string) => ['project-transactions', projectId] as const,
};

async function fetchProjectTransactions(projectId: string): Promise<ProjectTransactions> {
  const [posRes, invRes] = await Promise.all([
    supabase
      .from('client_purchase_orders')
      .select('id, project_id, po_number, po_date, po_total_value, po_utilized_value, po_available_value, status, client_id, remarks')
      .eq('project_id', projectId)
      .order('po_date', { ascending: false }),
    supabase
      .from('project_invoices')
      .select('id, project_id, po_id, invoice_number, invoice_date, invoice_amount, tax_amount, total_amount, status, remarks')
      .eq('project_id', projectId)
      .order('invoice_date', { ascending: false }),
  ]);

  if (posRes.error) throw posRes.error;
  if (invRes.error) throw invRes.error;

  return {
    pos: (posRes.data ?? []) as ProjectPO[],
    invoices: (invRes.data ?? []) as ProjectInvoice[],
  };
}

export function useProjectTransactions(projectId: string | null | undefined) {
  return useQuery({
    queryKey: projectTransactionKeys.detail(projectId ?? ''),
    queryFn: () => fetchProjectTransactions(projectId as string),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function buildProjectTransactionSummary(
  pos: ProjectPO[],
  invoices: ProjectInvoice[],
): ProjectTransactionSummary {
  const totalPOValue = pos.reduce((s, p) => s + (Number(p.po_total_value) || 0), 0);
  const totalInvoiced = invoices.reduce(
    (s, i) => (i.status === 'Cancelled' ? s : s + (Number(i.total_amount) || 0)),
    0,
  );
  const invoicedLinkedToPO = invoices.reduce(
    (s, i) => (i.po_id && i.status !== 'Cancelled' ? s + (Number(i.total_amount) || 0) : s),
    0,
  );
  const invoicedWithoutPO = totalInvoiced - invoicedLinkedToPO;
  const totalUtilized = pos.reduce((s, p) => s + (Number(p.po_utilized_value) || 0), 0);
  const totalAvailable = pos.reduce((s, p) => s + (Number(p.po_available_value) || 0), 0);
  const poBalance = totalPOValue - totalUtilized;

  const invoicesByPO = new Map<string, ProjectInvoice[]>();
  const unlinkedInvoices: ProjectInvoice[] = [];
  for (const inv of invoices) {
    if (inv.po_id) {
      const list = invoicesByPO.get(inv.po_id) ?? [];
      list.push(inv);
      invoicesByPO.set(inv.po_id, list);
    } else {
      unlinkedInvoices.push(inv);
    }
  }

  const perPO: POUtilization[] = pos.map(po => {
    const poTotal = Number(po.po_total_value) || 0;
    const utilized = Math.min(Number(po.po_utilized_value) || 0, poTotal);
    const available = poTotal - utilized;
    const list = (invoicesByPO.get(po.id) ?? []).filter(i => i.status !== 'Cancelled');
    const invoiced = list.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const utilizationPct = poTotal > 0 ? Math.min(100, Math.round((utilized / poTotal) * 100)) : 0;
    return {
      po,
      invoiced,
      available,
      utilizationPct,
      overInvoiced: invoiced > poTotal,
      invoices: list,
    };
  });

  return {
    totalPOValue,
    totalInvoiced,
    invoicedLinkedToPO,
    invoicedWithoutPO,
    totalUtilized,
    totalAvailable,
    poBalance,
    perPO,
    unlinkedInvoices,
  };
}
