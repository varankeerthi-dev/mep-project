import { useEffect, useMemo } from 'react';
import { Pencil, X, Package, Layers } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useBomDetailQuery } from '../../features/manufacturing';

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type BOMPreviewModalProps = {
  bomId: string | null;
  onClose: () => void;
  onEdit: (bomId: string) => void;
};

export default function BOMPreviewModal({ bomId, onClose, onEdit }: BOMPreviewModalProps) {
  const { data: bomDetail, isLoading } = useBomDetailQuery(bomId);

  useEffect(() => {
    if (!bomId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bomId, onClose]);

  const rows = useMemo(() => {
    if (!bomDetail?.items) return [];
    const byParent = new Map<string | null, any[]>();
    for (const it of bomDetail.items) {
      const key = it.parent_material_id || null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(it);
    }
    const out: { item: any; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const it of byParent.get(parent) || []) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        out.push({ item: it, depth });
        walk(it.id, depth + 1);
      }
    };
    walk(null, 0);
    for (const it of bomDetail.items) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        out.push({ item: it, depth: 0 });
      }
    }
    return out;
  }, [bomDetail]);

  if (!bomId) return null;

  const h = bomDetail?.header;
  const totalCost = rows.reduce((sum, r) => sum + (r.item.required_qty || 0) * (r.item.unit_cost || 0), 0);
  const costPerUnit = h?.output_qty > 0 ? totalCost / h.output_qty : 0;

  const details: { label: string; value: React.ReactNode }[] = h ? [
    { label: 'Product', value: h.product_name || '—' },
    { label: 'Revision', value: h.revision || 'A' },
    { label: 'Specification', value: h.specification || '—' },
    { label: 'Product Code / SKU', value: h.product_code || '—' },
    { label: 'BOM Type', value: <span className="capitalize">{h.bom_type || 'assembly'}</span> },
    { label: 'Output', value: `${h.output_qty} ${h.output_unit}` },
    { label: 'Effective From', value: h.effective_date || '—' },
    { label: 'Valid To', value: h.valid_to || '—' },
    { label: 'Approval Status', value: <span className="capitalize">{h.approval_status || 'draft'}</span> },
    { label: 'Description', value: h.description || '—' },
  ] : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[760px] max-h-[88vh] flex flex-col shadow-[0_25px_60px_rgba(15,23,42,0.25)] font-['Inter']"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Modal header ─── */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 truncate">
                {h?.bom_code || 'BOM'}
              </h2>
              {h?.revision && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Rev {h.revision}
                </span>
              )}
              {h?.specification && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 truncate max-w-[220px]">
                  {h.specification}
                </span>
              )}
              {h && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${h.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                  {h.is_active ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
            <p className="text-[12px] text-zinc-400 mt-0.5 truncate">{h?.product_name}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Modal body ─── */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {isLoading && (
            <p className="text-sm text-zinc-400 py-8 text-center">Loading BOM…</p>
          )}

          {!isLoading && !h && (
            <p className="text-sm text-zinc-400 py-8 text-center">BOM not found.</p>
          )}

          {h && (
            <>
              {/* Details — label left, value left-aligned, table with low-opacity rows */}
              <div className="rounded-xl border border-zinc-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFBFC] border-b border-zinc-100">
                  <Package className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">BOM Details</span>
                </div>
                <table className="w-full text-left">
                  <tbody>
                    {details.map(({ label, value }) => (
                      <tr key={label} className="border-b border-zinc-100/70 last:border-0 odd:bg-zinc-50/50">
                        <td className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 w-[170px] align-top">
                          {label}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-zinc-900 font-medium break-words">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Materials */}
              <div className="rounded-xl border border-zinc-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFBFC] border-b border-zinc-100">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Materials</span>
                  <span className="text-[10px] font-semibold text-zinc-400">({rows.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: '520px' }}>
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400">Material</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400 text-right">Qty</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400">Unit</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400 text-right">Unit Cost</th>
                        <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400 text-right">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ item, depth }) => {
                        const lineCost = (item.required_qty || 0) * (item.unit_cost || 0);
                        const isChild = depth > 0;
                        return (
                          <tr key={item.id} className="border-b border-zinc-50 last:border-0">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                                {isChild && <span className="text-zinc-300 text-[10px]">└</span>}
                                <span className={`text-[12px] ${isChild ? 'text-zinc-600' : 'text-zinc-900 font-semibold'}`}>
                                  {item.materials?.name || item.material_name || '—'}
                                </span>
                                {item.is_critical && (
                                  <span className="px-1 py-px rounded text-[8px] font-bold uppercase bg-rose-50 text-rose-500 border border-rose-100">Critical</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-[12px] text-zinc-700 tabular-nums text-right">{item.required_qty}</td>
                            <td className="px-3 py-2 text-[11px] text-zinc-500">{item.unit || '—'}</td>
                            <td className="px-3 py-2 text-[11px] text-zinc-500 tabular-nums text-right">₹{inr(item.unit_cost || 0)}</td>
                            <td className="px-4 py-2 text-[12px] text-zinc-900 font-medium tabular-nums text-right">₹{inr(lineCost)}</td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-[12px] text-zinc-400 italic">
                            No materials in this BOM.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#FAFBFC] border-t border-zinc-100">
                          <td colSpan={4} className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500 text-right">
                            Total Material Cost
                          </td>
                          <td className="px-4 py-2 text-[13px] font-bold text-zinc-900 tabular-nums text-right">₹{inr(totalCost)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 text-right">
                            Cost per Unit ({h.output_unit})
                          </td>
                          <td className="px-4 py-1.5 text-[12px] font-semibold text-blue-600 tabular-nums text-right">₹{inr(costPerUnit)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── Modal footer ─── */}
        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-zinc-100 shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            disabled={!bomId || !h}
            onClick={() => bomId && onEdit(bomId)}
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
          >
            Edit BOM
          </Button>
        </div>
      </div>
    </div>
  );
}
