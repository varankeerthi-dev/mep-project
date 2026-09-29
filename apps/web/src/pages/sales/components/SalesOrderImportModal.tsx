import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { toast } from '../../../lib/logger';
import { X as XIcon, Upload as UploadIcon, Loader2 } from 'lucide-react';
import { useCreateSalesOrder } from '../hooks';

interface ImportRow {
  line: number;
  client_name: string;
  item_ref: string;
  qty: number;
  rate: number;
  uom: string;
  delivery_date: string;
  remarks: string;
  error?: string;
}

// Minimal CSV parser: handles quoted fields, embedded commas, CRLF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const push = () => { row.push(field); field = ''; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      push();
    } else if (ch === '\n') {
      push(); rows.push(row); row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { push(); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const EXPECTED = 'client_name,item_code,qty,rate (optional: uom, delivery_date YYYY-MM-DD, remarks)';

export function SalesOrderImportModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const createMutation = useCreateSalesOrder();

  const { data: clients = [] } = useQuery({
    queryKey: ['so-import-clients', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, client_name').eq('organisation_id', orgId);
      return data || [];
    },
    enabled: open && !!orgId,
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['so-import-materials', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('id, name, item_code, unit, default_sale_price')
        .eq('organisation_id', orgId);
      return data || [];
    },
    enabled: open && !!orgId,
  });

  const groups = useMemo(() => {
    const map = new Map<string, ImportRow[]>();
    rows.forEach((r) => {
      if (r.error) return;
      const list = map.get(r.client_name) || [];
      list.push(r);
      map.set(r.client_name, list);
    });
    return [...map.entries()];
  }, [rows]);
  const errorCount = rows.filter((r) => r.error).length;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const grid = parseCsv(text);
    const body = grid[0] && grid[0][0]?.toLowerCase().includes('client') ? grid.slice(1) : grid;
    const parsed: ImportRow[] = body.map((cols, i) => {
      const [client_name = '', item_ref = '', qtyRaw = '', rateRaw = '', uom = '', delivery_date = '', remarks = ''] =
        cols.map((c) => c.trim());
      const row: ImportRow = {
        line: i + 2, client_name, item_ref,
        qty: parseFloat(qtyRaw) || 0, rate: parseFloat(rateRaw) || 0,
        uom: uom || 'nos', delivery_date, remarks,
      };
      if (!client_name) row.error = 'Missing client_name';
      else if (!(clients || []).some((c: any) => c.client_name.toLowerCase() === client_name.toLowerCase())) row.error = `Unknown client: ${client_name}`;
      else if (!item_ref) row.error = 'Missing item_code';
      else if (!(materials || []).some((m: any) =>
        (m.item_code || '').toLowerCase() === item_ref.toLowerCase() ||
        (m.name || '').toLowerCase() === item_ref.toLowerCase())) row.error = `Unknown item: ${item_ref}`;
      else if (!(row.qty > 0)) row.error = 'Qty must be > 0';
      else if (!(row.rate > 0)) row.error = 'Rate must be > 0';
      return row;
    });
    setRows(parsed);
  };

  const handleImport = async () => {
    if (groups.length === 0 || importing) return;
    setImporting(true);
    let ok = 0;
    const failed: string[] = [];
    for (const [clientName, lines] of groups) {
      try {
        const client = (clients || []).find((c: any) => c.client_name.toLowerCase() === clientName.toLowerCase());
        const { data: soNo } = await supabase.rpc('generate_sales_order_no', { p_org_id: orgId });
        const items = lines.map((l) => {
          const mat = (materials || []).find((m: any) =>
            (m.item_code || '').toLowerCase() === l.item_ref.toLowerCase() ||
            (m.name || '').toLowerCase() === l.item_ref.toLowerCase());
          const lineSub = l.qty * l.rate;
          return {
            item_id: mat.id,
            description: mat.name,
            qty: l.qty,
            uom: l.uom,
            rate: l.rate,
            discount_percent: 0,
            tax_percent: 18,
            line_total: parseFloat((lineSub * 1.18).toFixed(2)),
          };
        });
        const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
        const tax = subtotal * 0.18;
        await createMutation.mutateAsync({
          orgId,
          userId: null,
          header: {
            sales_order_no: soNo,
            client_id: client.id,
            delivery_date: lines[0].delivery_date || null,
            remarks: lines[0].remarks || `Imported from ${fileName}`,
            subtotal: parseFloat(subtotal.toFixed(2)),
            tax_amount: parseFloat(tax.toFixed(2)),
            grand_total: parseFloat((subtotal + tax).toFixed(2)),
            status: 'draft',
            organisation_id: orgId,
          },
          items,
        });
        ok++;
      } catch (e: any) {
        failed.push(`${clientName}: ${e.message || e}`);
      }
    }
    setImporting(false);
    if (failed.length > 0) toast.error(`Imported ${ok}, failed ${failed.length}: ${failed.slice(0, 3).join('; ')}`);
    else toast.success(`Imported ${ok} sales order(s)`);
    if (ok > 0) { setRows([]); setFileName(''); onClose(); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[720px] max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-[#0B1C30]">Import Sales Orders</h3>
            <p className="text-xs text-[#475569] mt-0.5">CSV columns: {EXPECTED}. One order per client.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-[#475569] hover:text-[#0B1C30] rounded-md">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[#CBD5E1] text-[13px] font-semibold text-[#0B1C30] hover:bg-zinc-50 cursor-pointer">
            <UploadIcon className="w-4 h-4" />
            {fileName || 'Choose CSV file'}
            <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
          </label>
          {rows.length > 0 && (
            <div className="mt-3 text-xs text-[#475569]">
              {rows.length - errorCount} valid row(s) - {groups.length} order(s)
              {errorCount > 0 && <span className="text-red-600 font-semibold">, {errorCount} error(s)</span>}
            </div>
          )}
          {rows.length > 0 && (
            <div className="mt-2 rounded-xl border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#EFF4FF] text-[11px] uppercase text-[#334155]">
                    <th className="text-left px-3 py-2">Line</th>
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Rate</th>
                    <th className="text-left px-3 py-2">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#F1F5F9]">
                      <td className="px-3 py-1.5 text-zinc-400">{r.line}</td>
                      <td className="px-3 py-1.5">{r.client_name}</td>
                      <td className="px-3 py-1.5">{r.item_ref}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.qty}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.rate}</td>
                      <td className="px-3 py-1.5 text-red-600">{r.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-4 text-[13px] font-semibold text-[#0B1C30] bg-white border border-[#CBD5E1] rounded-lg hover:bg-zinc-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || groups.length === 0}
            className="h-9 px-4 text-[13px] font-bold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            {importing ? 'Importing...' : `Import ${groups.length} order(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
