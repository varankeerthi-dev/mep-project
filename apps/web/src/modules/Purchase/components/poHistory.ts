/**
 * Recent purchase history for one material — the "Recent" button in the PO
 * line-item Rate cell.
 *
 * Source: purchase_bill_items joined to purchase_bills (vendor invoice no,
 * bill date, supplier). Grouped in the drawer by month.
 *
 * PERFORMANCE CONTRACT (explicit user requirement): this query must never slow
 * PO creation. Guarantees:
 *   1. Nothing fetches on editor load — the query is `enabled` only while the
 *      drawer is open for a specific material.
 *   2. One material at a time, latest 20 lines. No N+1, no list-wide prefetch.
 *   3. Single round-trip: items + bill + vendor in one embedded select.
 *   4. Cached per material by react-query, so reopening is instant.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { withSessionCheck } from '../../../queryClient';

export interface MaterialHistoryLine {
  billDate: string | null;
  billNumber: string | null;
  invoiceNo: string | null;
  vendorName: string;
  quantity: number;
  unit: string | null;
  rate: number;
  lineTotal: number;
}

export interface MaterialHistoryGroup {
  /** e.g. "September 2026" — the drawer's category header. */
  label: string;
  lines: MaterialHistoryLine[];
}

const HISTORY_LIMIT = 20;

export function useMaterialPurchaseHistory(
  orgId: string | null | undefined,
  materialId: string | null | undefined,
  open: boolean,
) {
  const query = useQuery({
    queryKey: ['po-v2-material-history', orgId, materialId],
    queryFn: withSessionCheck(async (): Promise<MaterialHistoryLine[]> => {
      if (!orgId || !materialId) return [];
      try {
        const { data, error } = await supabase
          .from('purchase_bill_items')
          .select(
            'quantity, unit, rate, total_amount, ' +
            'bill:purchase_bills!inner(bill_date, bill_number, vendor_invoice_no, vendor:purchase_vendors(company_name))',
          )
          .eq('organisation_id', orgId)
          .eq('item_id', materialId)
          .order('bill_date', { foreignTable: 'bill', ascending: false })
          .limit(HISTORY_LIMIT);
        if (error) throw error;
        return ((data || []) as any[]).map((r) => ({
          billDate: r.bill?.bill_date || null,
          billNumber: r.bill?.bill_number || null,
          invoiceNo: r.bill?.vendor_invoice_no || null,
          vendorName: r.bill?.vendor?.company_name || '—',
          quantity: Number(r.quantity ?? 0),
          unit: r.unit || null,
          rate: Number(r.rate ?? 0),
          lineTotal: Number(r.total_amount ?? 0),
        }));
      } catch (e) {
        // Fallback: some PostgREST versions reject ordering by an embedded
        // resource. Retry unordered and sort client-side (20 rows — trivial).
        console.warn('[poHistory] ordered fetch failed, retrying unordered:', e);
        const { data, error } = await supabase
          .from('purchase_bill_items')
          .select(
            'quantity, unit, rate, total_amount, created_at, ' +
            'bill:purchase_bills!inner(bill_date, bill_number, vendor_invoice_no, vendor:purchase_vendors(company_name))',
          )
          .eq('organisation_id', orgId)
          .eq('item_id', materialId)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT);
        if (error) throw error;
        return (((data || []) as any[])
          .map((r) => ({
            billDate: r.bill?.bill_date || null,
            billNumber: r.bill?.bill_number || null,
            invoiceNo: r.bill?.vendor_invoice_no || null,
            vendorName: r.bill?.vendor?.company_name || '—',
            quantity: Number(r.quantity ?? 0),
            unit: r.unit || null,
            rate: Number(r.rate ?? 0),
            lineTotal: Number(r.total_amount ?? 0),
          }))
          .sort((a, b) => String(b.billDate || '').localeCompare(String(a.billDate || ''))));
      }
    }),
    // The whole point: never run until the user opens the drawer.
    enabled: !!orgId && !!materialId && open,
    staleTime: 60_000,
  });

  return query;
}

/** Group lines under month headers, newest month first. */
export function groupHistoryByMonth(lines: MaterialHistoryLine[]): MaterialHistoryGroup[] {
  const groups = new Map<string, MaterialHistoryLine[]>();
  for (const line of lines) {
    let label = 'Undated';
    if (line.billDate) {
      const d = new Date(line.billDate);
      if (!Number.isNaN(d.getTime())) {
        label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      }
    }
    const bucket = groups.get(label);
    if (bucket) bucket.push(line);
    else groups.set(label, [line]);
  }
  return [...groups.entries()].map(([label, groupLines]) => ({ label, lines: groupLines }));
}
