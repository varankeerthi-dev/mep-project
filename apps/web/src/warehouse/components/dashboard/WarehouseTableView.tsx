import { Button } from '../../../components/ui/Button';
// src/warehouse/components/dashboard/WarehouseTableView.tsx
// PRD §2.6 — Table View, the second Dashboard sub-tab. Multiple datasets in
// sortable, filterable tables (bins, movements, transfers, dispatches, pick
// lists). Consumes the existing org-scoped hooks — no business logic here.

import { useMemo, useState } from 'react';
import { ArrowUpDown, Loader2, Search } from 'lucide-react';
import {
  useBinCandidates,
  useMovements,
  useTransfers,
  useDispatches,
  usePickLists,
} from '../../hooks/useWarehouseData';
import { movementTypeLabel } from '../../dashboard';

type DatasetId = 'bins' | 'movements' | 'transfers' | 'dispatches' | 'picks';

const DATASETS: { id: DatasetId; label: string }[] = [
  { id: 'bins', label: 'Bins' },
  { id: 'movements', label: 'Movement History' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'dispatches', label: 'Dispatches' },
  { id: 'picks', label: 'Pick Lists' },
];

interface Column<T> {
  key: string;
  label: string;
  get: (row: T) => string | number | null | undefined;
  numeric?: boolean;
}

export default function WarehouseTableView() {
  const [dataset, setDataset] = useState<DatasetId>('bins');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const bins = useBinCandidates();
  const movements = useMovements();
  const transfers = useTransfers();
  const dispatches = useDispatches();
  const picks = usePickLists();

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const { columns, rows, loading } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = <T,>(rows: T[], keys: (r: T) => Array<string | number | null | undefined>) =>
      !q ? rows : rows.filter(r => keys(r).some(v => String(v ?? '').toLowerCase().includes(q)));

    switch (dataset) {
      case 'bins': {
        const cols: Column<any>[] = [
          { key: 'name', label: 'Bin', get: b => b.name },
          { key: 'zone', label: 'Zone', get: b => b.zoneName ?? '—' },
          { key: 'role', label: 'Storage Role', get: b => b.storageRole ?? '—' },
          { key: 'currentQty', label: 'Qty', get: b => b.currentQty ?? 0, numeric: true },
          { key: 'free', label: 'Free', get: b => b.freeCapacity === Infinity ? '∞' : b.freeCapacity ?? 0, numeric: true },
          { key: 'status', label: 'Status', get: b => (b.blocked ? 'blocked' : b.qualityHold ? 'quality hold' : 'ok') },
        ] as Column<any>[];
        return { columns: cols, rows: filter(bins.data ?? [], b => [b.name, b.zoneName, b.storageRole]), loading: bins.isLoading };
      }
      case 'movements': {
        const cols: Column<{ [k: string]: any }>[] = [
          { key: 'at', label: 'When', get: m => m.created_at ?? '' },
          { key: 'type', label: 'Type', get: m => movementTypeLabel(m.movement_type) },
          { key: 'qty', label: 'Qty', get: m => m.quantity ?? 0, numeric: true },
          { key: 'ref', label: 'Reference', get: m => m.reference_type },
          { key: 'remarks', label: 'Remarks', get: m => m.remarks ?? '—' },
        ];
        return { columns: cols, rows: filter(movements.data ?? [], m => [m.movement_type, m.reference_type, m.remarks]), loading: movements.isLoading };
      }
      case 'transfers': {
        const cols: Column<{ [k: string]: any }>[] = [
          { key: 'no', label: 'Transfer', get: t => t.transfer_no ?? '' },
          { key: 'item', label: 'Item', get: t => t.itemName ?? '—' },
          { key: 'from', label: 'From → To', get: t => `${t.sourceBinName ?? '—'} → ${t.destinationBinName ?? '—'}` },
          { key: 'qty', label: 'Qty', get: t => t.quantity ?? 0, numeric: true },
          { key: 'priority', label: 'Priority', get: t => t.priority },
          { key: 'status', label: 'Status', get: t => t.status },
        ];
        return { columns: cols, rows: filter(transfers.data ?? [], t => [t.transfer_no, t.itemName, t.sourceBinName, t.destinationBinName, t.status]), loading: transfers.isLoading };
      }
      case 'dispatches': {
        const cols: Column<{ [k: string]: any }>[] = [
          { key: 'no', label: 'Dispatch', get: d => d.dispatch_no ?? '' },
          { key: 'so', label: 'SO Ref', get: d => d.sales_order_ref ?? '—' },
          { key: 'item', label: 'Item', get: d => d.itemName ?? '—' },
          { key: 'qty', label: 'Qty', get: d => d.quantity ?? 0, numeric: true },
          { key: 'status', label: 'Status', get: d => d.status },
        ];
        return { columns: cols, rows: filter(dispatches.data ?? [], d => [d.dispatch_no, d.sales_order_ref, d.itemName, d.status]), loading: dispatches.isLoading };
      }
      case 'picks': {
        const cols: Column<{ [k: string]: any }>[] = [
          { key: 'no', label: 'Pick List', get: p => p.pick_no ?? '' },
          { key: 'item', label: 'Item', get: p => p.itemName ?? '—' },
          { key: 'ref', label: 'Source Ref', get: p => p.source_ref ?? '—' },
          { key: 'lines', label: 'Lines', get: p => p.items?.length ?? 0, numeric: true },
          { key: 'status', label: 'Status', get: p => p.status },
        ];
        return { columns: cols, rows: filter(picks.data ?? [], p => [p.pick_no, p.itemName, p.source_ref, p.status]), loading: picks.isLoading };
      }
    }
  }, [dataset, query, bins.data, movements.data, transfers.data, dispatches.data, picks.data, bins.isLoading, movements.isLoading, transfers.isLoading, dispatches.isLoading, picks.isLoading]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find(c => c.key === sortKey) as Column<any> | undefined;
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const av = col.get(a); const bv = col.get(b);
      const an = Number(av) || String(av ?? '');
      const bn = Number(bv) || String(bv ?? '');
      let cmp: number;
      if (typeof an === 'number' && typeof bn === 'number') cmp = an - bn;
      else cmp = String(an).localeCompare(String(bn));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      {/* Dataset picker + search */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
          {DATASETS.map(d => (
            <Button variant="ghost" size="sm"
              key={d.id}
              onClick={() => { setDataset(d.id); setSortKey(''); }}
              className={`px-2.5 h-7 rounded-md text-[10.5px] font-bold transition-all ${dataset === d.id ? 'bg-white text-blue-700 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              {d.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-sm ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Filter ${DATASETS.find(d => d.id === dataset)?.label.toLowerCase()}…`}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <span className="text-[10px] text-zinc-400">{sorted.length} rows</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-400 italic">No rows match the current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {columns.map(c => (
                    <th key={c.key} className="px-3 py-2">
                      <Button variant="ghost" size="sm"
                        onClick={() => toggleSort(c.key)}
                        className={`flex items-center gap-1 hover:text-zinc-800 transition-all ${sortKey === c.key ? 'text-blue-700' : ''}`}
                      >
                        {c.label}
                        <ArrowUpDown size={10} className={sortKey === c.key ? 'opacity-100' : 'opacity-40'} />
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60 transition-colors">
                    {columns.map(c => (
                      <td key={c.key} className={`px-3 py-2 text-[10.5px] text-zinc-700 ${c.numeric ? 'tabular-nums text-right font-semibold' : ''}`}>
                        {c.get(row) ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length > 200 && (
              <div className="px-3 py-2 text-[9.5px] text-zinc-400 border-t border-zinc-100">Showing first 200 of {sorted.length} — refine the filter to narrow.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
