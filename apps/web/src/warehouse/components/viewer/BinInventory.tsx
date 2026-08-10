import { Button } from '../../../components/ui/button';
// src/warehouse/components/viewer/BinInventory.tsx
// Phase 3 — Item ↔ Bin Mapping inside the property panel. Shows the items
// currently stored in a bin and lets the operator add / adjust / remove
// stock with live capacity validation (PRD "Capacity Validation").

import { useMemo, useState } from 'react';
import { Plus, Minus, Trash2, Star, Check, PackageSearch } from 'lucide-react';
import type { ResolvedBinItem, AssignableItem } from '../../inventory';
import { validateBinCapacity, binCurrentQty } from '../../inventory';

interface BinInventoryProps {
  binId: string;
  binName: string;
  maxQty: number | null | undefined;
  items: ResolvedBinItem[];
  assignableItems: AssignableItem[];
  onAssignItem: (itemId: string, quantity: number) => void;
  onAdjustQty: (rowId: string, delta: number) => void;
  onRemoveItem: (rowId: string) => void;
  onSetPrimary: (rowId: string, primary: boolean) => void;
  busy?: boolean;
}

export default function BinInventory({
  binId,
  binName,
  maxQty,
  items,
  assignableItems,
  onAssignItem,
  onAdjustQty,
  onRemoveItem,
  onSetPrimary,
  busy,
}: BinInventoryProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState<number | ''>(1);
  const currentQty = useMemo(() => binCurrentQty(new Map([[binId, items]]), binId), [binId, items]);

  const check = validateBinCapacity(maxQty, currentQty, Number(qty) || 0);
  const qtyNum = Number(qty) || 0;
  const canAdd = !!selectedItemId && qtyNum > 0 && check.ok;

  const assign = () => {
    if (!canAdd) return;
    onAssignItem(selectedItemId, qtyNum);
    setQty(1);
  };

  // Items already in this bin (exclude from the picker to avoid confusion —
  // assigning again just overwrites/merges via upsert, so allow it too).
  const inBinIds = new Set(items.map(i => i.itemId));

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
          <PackageSearch size={11} /> Items in bin
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500">{currentQty}{maxQty ? ` / ${maxQty}` : ''} qty</span>
      </div>

      {/* Item rows */}
      {items.length === 0 && (
        <div className="text-[10.5px] text-zinc-400 italic">Empty — assign stock below.</div>
      )}
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="rounded-md border border-zinc-100 bg-zinc-50/70 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="flex-1 min-w-0 text-[11px] font-semibold text-zinc-800 truncate" title={item.itemName}>
                {item.itemName}
              </span>
              <Button variant="ghost" size="sm"
                title={item.isPrimary ? 'Primary picking bin' : 'Set as primary picking bin'}
                onClick={() => onSetPrimary(item.id, !item.isPrimary)}
                className={`p-0.5 rounded transition-all ${item.isPrimary ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-400'}`}
              >
                <Star size={12} fill={item.isPrimary ? 'currentColor' : 'none'} />
              </Button>
              <Button variant="ghost" size="sm" title="Remove from bin" onClick={() => onRemoveItem(item.id)}
                className="p-0.5 rounded text-zinc-300 hover:text-red-500 transition-all">
                <Trash2 size={12} />
              </Button>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Button variant="ghost" size="sm" onClick={() => onAdjustQty(item.id, -1)} disabled={busy}
                className="p-0.5 rounded bg-white border border-zinc-200 text-zinc-500 hover:text-red-500 hover:border-red-200 disabled:opacity-40 transition-all">
                <Minus size={11} />
              </Button>
              <span className="flex-1 text-center text-[11px] font-bold tabular-nums text-zinc-800">{item.quantity}</span>
              <Button variant="ghost" size="sm" onClick={() => onAdjustQty(item.id, 1)} disabled={busy}
                className="p-0.5 rounded bg-white border border-zinc-200 text-zinc-500 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 transition-all">
                <Plus size={11} />
              </Button>
              {item.isReserve && <span className="text-[8.5px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-0.5 uppercase">Reserve</span>}
              {item.batchNo && <span className="text-[8.5px] text-zinc-400 font-mono truncate max-w-[70px]">B:{item.batchNo}</span>}
              {item.lotNo && <span className="text-[8.5px] text-zinc-400 font-mono truncate max-w-[70px]">L:{item.lotNo}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Assign form */}
      <div className="rounded-md border border-zinc-200 p-2 space-y-1.5">
        <div className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wide">Assign stock</div>
        <select
          value={selectedItemId}
          onChange={e => setSelectedItemId(e.target.value)}
          className="w-full h-7 px-2 rounded border border-zinc-200 text-[11px] text-zinc-700 bg-white outline-none focus:border-blue-400"
        >
          <option value="">Select item…</option>
          {assignableItems.map(i => (
            <option key={i.id} value={i.id}>
              {i.name}{i.code ? ` (${i.code})` : ''}
              {inBinIds.has(i.id) ? ' · in bin' : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={e => setQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            className="w-16 h-7 px-2 rounded border border-zinc-200 text-[11px] tabular-nums text-zinc-800 outline-none focus:border-blue-400"
            placeholder="Qty"
          />
          <Button variant="ghost" size="sm"
            onClick={assign}
            disabled={!canAdd || busy}
            className="flex-1 flex items-center justify-center gap-1 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-bold disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Check size={11} /> Add to {binName}
          </Button>
        </div>
        {!check.ok && (
          <div className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-1">
            Exceeds capacity by {check.exceedsBy} ({currentQty} + {qtyNum} &gt; {maxQty})
          </div>
        )}
        {check.ok && hasCapacityCap(maxQty) && (
          <div className="text-[9.5px] text-zinc-400 tabular-nums">
            {check.remaining} of {maxQty} remaining
          </div>
        )}
      </div>
    </div>
  );
}

function hasCapacityCap(maxQty: number | null | undefined): boolean {
  return maxQty != null && Number(maxQty) > 0;
}
