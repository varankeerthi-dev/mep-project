import { Button } from '../../components/ui/Button';
import { PageSkeleton } from '../../components/ui/skeleton';
// src/warehouse/pages/InventoryPage.tsx
// Phase 3 — Inventory Location Management (PRD: Inventory Location
// Management, Item ↔ Bin Mapping, Excel Bulk Editor, Bulk Assignment).
// A searchable Excel-style grid over every bin in a warehouse with inline
// item assignment, quantity adjustment, primary/reserve flags and live
// capacity validation. Occupancy colours in the viewer go live as soon as
// rows are saved here.

import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Warehouse, Search, X, Boxes, Plus, Minus, Trash2, Star, Loader2, ChevronDown, CheckCircle2,
} from 'lucide-react';
import {
  useWarehouses,
  useInventory,
  useAssignableItems,
  useAssignBinItem,
  useAdjustBinItemQty,
  useDeleteBinItem,
  useSetBinItemFlags,
} from '../hooks/useWarehouseData';
import { buildInventoryRows, inventoryRowHaystack, validateBinCapacity, type InventoryRow, type AssignableItem } from '../inventory';

interface Props {
  onNavigate?: (path: string) => void;
}

export default function InventoryPage({ onNavigate }: Props) {
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;
  const location = useLocation();

  // Pick a warehouse from the path (/warehouse/inventory/<id>) or the picker.
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pathIdx = pathParts.findIndex(p => p === 'inventory');
  const pathWarehouseId = pathIdx >= 0 ? pathParts[pathIdx + 1] : undefined;

  const { data: warehouses = [], isLoading: loadingWarehouses } = useWarehouses();
  const warehouseId = pathWarehouseId ?? warehouses[0]?.id;
  const { data, isLoading } = useInventory(warehouseId);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkItemId, setBulkItemId] = useState('');
  const [bulkQty, setBulkQty] = useState<number | ''>(10);

  const { data: assignableItems = [] } = useAssignableItems();
  const assignItem = useAssignBinItem();
  const adjustQty = useAdjustBinItemQty();
  const removeItem = useDeleteBinItem();
  const setPrimary = useSetBinItemFlags();
  const busy = assignItem.isPending || adjustQty.isPending || removeItem.isPending || setPrimary.isPending;

  const rows = useMemo<InventoryRow[]>(() => {
    if (!data?.structure) return [];
    return buildInventoryRows(data.structure, data.itemsByBin);
  }, [data]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim();
    return rows.filter(r => inventoryRowHaystack(r).includes(q.replace(/[-_\s]+/g, '').toLowerCase()));
  }, [rows, query]);

  const itemName = (id: string) => assignableItems.find(i => i.id === id)?.name ?? id;

  const pickWarehouse = (id: string) => navigate(`/warehouse/inventory/${id}`);

  const toggleSelected = (binId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });
  };

  const assignToBin = (binId: string, itemId: string, quantity: number) => {
    if (!itemId || quantity <= 0) return;
    const row = rows.find(r => r.binId === binId);
    const check = validateBinCapacity(row?.binMaxQty ?? 0, row?.currentQty ?? 0, quantity);
    if (!check.ok) return; // caller shows the warning inline
    assignItem.mutate({ warehouseId, assignment: { binId, itemId, quantity } });
  };

  const bulkAssign = () => {
    if (!bulkItemId || !bulkQty || selected.size === 0) return;
    for (const binId of selected) {
      assignToBin(binId, bulkItemId, Number(bulkQty));
    }
  };

  const qtyNum = Number(bulkQty) || 0;
  const selectedRows = rows.filter(r => selected.has(r.binId));
  const blockedCount = selectedRows.filter(r => {
    const check = validateBinCapacity(r.binMaxQty, r.currentQty, qtyNum);
    return !check.ok;
  }).length;

  if (loadingWarehouses) return <PageSkeleton variant="list" rows={4} />;

  if (warehouses.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-zinc-400">
        No warehouses yet — design one first, then manage its inventory here.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1400px] mx-auto px-4 pt-3 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Boxes size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 m-0">Inventory Location Management</h1>
              <div className="text-[10px] text-zinc-400">
                Assign stock to bins — occupancy colours update live in the Viewer
              </div>
            </div>
          </div>
          <div className="relative">
            <select
              value={warehouseId ?? ''}
              onChange={e => pickWarehouse(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 rounded-lg border border-zinc-200 bg-white text-[11px] font-semibold text-zinc-700 outline-none focus:border-blue-400 cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name ?? w.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {isLoading || !data ? (
          <PageSkeleton variant="table" rows={8} />
        ) : (
          <>
            {/* Toolbar: search + bulk assign */}
            <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 mb-3 flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search bin, rack, zone, item, batch, lot…"
                  className="w-full h-8 pl-8 pr-8 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {query && (
                  <Button variant="ghost" size="sm" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                    <X size={12} />
                  </Button>
                )}
              </div>

              <div className="h-6 w-px bg-zinc-200 hidden md:block" />

              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider hidden md:inline">Bulk assign</span>
              <select
                value={bulkItemId}
                onChange={e => setBulkItemId(e.target.value)}
                className="h-8 pl-2.5 pr-2 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-700 outline-none focus:border-blue-400 max-w-[220px]"
              >
                <option value="">Select item…</option>
                {assignableItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={bulkQty}
                onChange={e => setBulkQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                className="w-20 h-8 px-2 rounded-lg border border-zinc-200 text-[11px] tabular-nums text-zinc-800 outline-none focus:border-blue-400"
                placeholder="Qty"
              />
              <Button variant="ghost" size="sm"
                onClick={bulkAssign}
                disabled={!bulkItemId || !bulkQty || selected.size === 0}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <CheckCircle2 size={12} /> Assign to {selected.size} bin{selected.size !== 1 ? 's' : ''}
              </Button>
              {blockedCount > 0 && (
                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-1">
                  {blockedCount} would exceed capacity
                </span>
              )}
              {selected.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-600">
                  Clear
                </Button>
              )}
            </div>

            {/* Grid */}
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.binId)) : new Set())}
                        className="accent-blue-600"
                      />
                    </th>
                    <th className="px-3 py-2">Bin</th>
                    <th className="px-3 py-2">Rack</th>
                    <th className="px-3 py-2">Zone</th>
                    <th className="px-3 py-2">Capacity</th>
                    <th className="px-3 py-2 min-w-[260px]">Items</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-zinc-400 italic">No bins match “{query}”.</td>
                    </tr>
                  )}
                  {filtered.map(row => {
                    const checked = selected.has(row.binId);
                    const cap = row.binMaxQty;
                    const pct = cap > 0 ? Math.min(100, Math.round((row.currentQty / cap) * 100)) : 0;
                    const over = cap > 0 && row.currentQty > cap;
                    return (
                      <tr key={row.binId} className={`border-b border-zinc-50 last:border-0 ${checked ? 'bg-blue-50/40' : ''} hover:bg-zinc-50/60 transition-colors`}>
                        <td className="px-3 py-2 align-top pt-3">
                          <input type="checkbox" checked={checked} onChange={() => toggleSelected(row.binId)} className="accent-blue-600" />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-[11.5px] font-bold text-zinc-800 font-mono">{row.binName}</div>
                          <div className="text-[9.5px] text-zinc-400">{row.binCode ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-zinc-600">{row.rackName}</td>
                        <td className="px-3 py-2 align-top text-[11px] text-zinc-600">{row.zoneName}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-[10.5px] tabular-nums">
                            <span className={over ? 'text-red-600 font-bold' : 'text-zinc-700 font-semibold'}>{row.currentQty}</span>
                            <span className="text-zinc-400"> / {cap > 0 ? cap : '∞'}</span>
                          </div>
                          {cap > 0 && (
                            <div className="w-16 h-1.5 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 90 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                          {over && <div className="text-[9px] font-bold text-red-500 mt-0.5">Over capacity</div>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {row.items.length === 0 ? (
                            <EmptyBinAssign
                              binId={row.binId}
                              maxQty={row.binMaxQty}
                              currentQty={row.currentQty}
                              assignableItems={assignableItems}
                              onAssign={(itemId, quantity) => assignToBin(row.binId, itemId, quantity)}
                              busy={busy}
                            />
                          ) : (
                            <div className="space-y-1">
                              {row.items.map(item => (
                                <div key={item.id} className="flex items-center gap-1.5 rounded-md border border-zinc-100 bg-zinc-50/70 px-2 py-1">
                                  <span className="flex-1 min-w-0 text-[11px] font-semibold text-zinc-800 truncate" title={item.itemName}>
                                    {item.itemName}
                                    {item.itemCode && <span className="text-zinc-400 font-normal"> · {item.itemCode}</span>}
                                  </span>
                                  <Button variant="ghost" size="sm"
                                    title={item.isPrimary ? 'Primary picking bin' : 'Set as primary'}
                                    onClick={() => setPrimary.mutate({ warehouseId, rowId: item.id, flags: { isPrimary: !item.isPrimary } })}
                                    className={`p-0.5 rounded transition-all ${item.isPrimary ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-400'}`}
                                  >
                                    <Star size={12} fill={item.isPrimary ? 'currentColor' : 'none'} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => adjustQty.mutate({ warehouseId, rowId: item.id, delta: -1 })} disabled={busy}
                                    className="p-0.5 rounded bg-white border border-zinc-200 text-zinc-500 hover:text-red-500 disabled:opacity-40 transition-all">
                                    <Minus size={11} />
                                  </Button>
                                  <span className="text-[11px] font-bold tabular-nums text-zinc-800 w-6 text-center">{item.quantity}</span>
                                  <Button variant="ghost" size="sm" onClick={() => adjustQty.mutate({ warehouseId, rowId: item.id, delta: 1 })} disabled={busy}
                                    className="p-0.5 rounded bg-white border border-zinc-200 text-zinc-500 hover:text-emerald-600 disabled:opacity-40 transition-all">
                                    <Plus size={11} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => removeItem.mutate({ warehouseId, rowId: item.id })} disabled={busy}
                                    className="p-0.5 rounded text-zinc-300 hover:text-red-500 disabled:opacity-40 transition-all">
                                    <Trash2 size={11} />
                                  </Button>
                                </div>
                              ))}
                              <EmptyBinAssign
                                binId={row.binId}
                                maxQty={row.binMaxQty}
                                currentQty={row.currentQty}
                                assignableItems={assignableItems}
                                onAssign={(itemId, quantity) => assignToBin(row.binId, itemId, quantity)}
                                busy={busy}
                                compact
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Button variant="ghost" size="sm"
                            onClick={() => warehouseId && navigate(`/warehouse/viewer/${warehouseId}`)}
                            title="Open in viewer"
                            className="p-1.5 rounded text-zinc-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Warehouse size={13} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-zinc-400 mt-2 flex items-center gap-3">
              <span className="flex items-center gap-1"><Star size={10} className="text-amber-500" /> primary picking bin</span>
              <span>·</span>
              <span>{filtered.length} of {rows.length} bins{query ? ' shown' : ''}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Warehouse size={10} /> rows open in the 2D Viewer</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyBinAssign({
  binId,
  maxQty,
  currentQty,
  assignableItems,
  onAssign,
  busy,
  compact,
}: {
  binId: string;
  maxQty: number;
  currentQty: number;
  assignableItems: AssignableItem[];
  onAssign: (itemId: string, quantity: number) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState<number | ''>(1);
  const qtyNum = Number(qty) || 0;
  const check = validateBinCapacity(maxQty, currentQty, qtyNum);
  const canAdd = !!itemId && qtyNum > 0 && check.ok;

  const submit = () => {
    if (!canAdd) return;
    onAssign(itemId, qtyNum);
    setQty(1);
  };

  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'rounded-md border border-dashed border-zinc-200 p-1.5'}`}>
      <select
        value={itemId}
        onChange={e => setItemId(e.target.value)}
        className={`h-7 rounded border border-zinc-200 bg-white text-[11px] text-zinc-700 outline-none focus:border-blue-400 ${compact ? 'max-w-[140px]' : 'flex-1 min-w-[120px]'} px-1.5`}
      >
        <option value="">Assign…</option>
        {assignableItems.map(i => (
          <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        value={qty}
        onChange={e => setQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
        className="w-16 h-7 px-1.5 rounded border border-zinc-200 text-[11px] tabular-nums text-zinc-800 outline-none focus:border-blue-400"
        placeholder="Qty"
      />
      <Button variant="ghost" size="sm" onClick={submit} disabled={!canAdd || busy}
        className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-bold disabled:opacity-40 disabled:pointer-events-none transition-all">
        <Plus size={11} />
      </Button>
      {!check.ok && (
        <span className="text-[9.5px] font-semibold text-red-600" title={`Exceeds capacity by ${check.exceedsBy}`}>
          +{check.exceedsBy} over
        </span>
      )}
    </div>
  );
}
