import { Button } from '../../components/ui/button';
import { PageSkeleton } from '../../components/ui/skeleton';
// src/warehouse/pages/OperationsPage.tsx
// Phase 4 — Warehouse Operations (PRD §9.10–§9.25 Stock Movement Engine).
// Three workflows in one module tab:
//   * Receiving      — put stock away with put-away suggestions (PRD §9.16)
//   * Transfers      — internal transfer lifecycle: create → validate →
//                      approve → pick → move → confirm → complete (PRD §9.11),
//                      5 priorities, 9 statuses, transfer validation (PRD §9.19)
//                      + movement audit history (PRD §9.23)
//   * Replenishment  — rules (min/max) + Bulk → Picking queue (PRD §9.14)
//
// All executions go through the atomic RPCs (migration 005) so no stock
// movement happens without an audit record.

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight, Boxes, ClipboardList, Loader2, PackagePlus, RefreshCcw,
  Search, Send, CheckCircle2, XCircle, Info, AlertTriangle, History,
  Plus, Trash2, Truck, PackageCheck, Lock, Unlock, ClipboardCheck, ChevronDown, ChevronUp,
  ListChecks,
} from 'lucide-react';
import {
  useTransfers,
  useCreateTransfer,
  useAdvanceTransfer,
  useExecuteTransfer,
  useMovements,
  useBinCandidates,
  useReceiveStock,
  useReplenishmentRules,
  useUpsertReplenishmentRule,
  useSetReplenishmentRuleEnabled,
  useDeleteReplenishmentRule,
  useExecuteReplenishment,
  useAssignableItems,
  useWarehouses,
  useOrgBinItems,
  useDispatches,
  useCreateDispatch,
  useAdvanceDispatch,
  useReserveDispatch,
  useReleaseDispatchReserve,
  useExecuteDispatch,
  useReverseMovement,
  usePickLists,
  useCreatePickList,
  useAdvancePickList,
  useUpdatePickLineQty,
  useCompletePickList,
  useCycleCounts,
  useCreateCycleCountBatch,
  useFreezeCycleScope,
  useUnfreezeCycleScope,
  useSubmitCycleCountItem,
  useApproveCycleCountBatch,
  useCancelCycleCountBatch,
  useOpenPurchaseOrders,
  useOrgStructure,
  canFreeze,
  canApprove,
  canCancel,
  CYCLE_STATUS_META,
  CYCLE_QUEUE_ORDER,
} from '../hooks/useWarehouseData';
import type { CycleCountBatchView, DispatchView, PickListView, TransferView } from '../services/warehouseService';
import {
  TRANSFER_STATUS_META,
  TRANSFER_PRIORITY_META,
  TRANSFER_PRIORITIES,
  nextTransferAction,
  validateTransfer,
  hasErrors,
  suggestPutaway,
  suggestOverflow,
  computeReplenishmentNeeds,
  suggestConsolidation,
} from '../operations';
import {
  DISPATCH_STATUS_META,
  DISPATCH_QUEUE_ORDER,
  nextDispatchAction,
  validateDispatch,
  hasDispatchErrors,
  hasActiveReservation,
  groupDispatchQueue,
} from '../dispatch';
import { canReverseMovement, REVERSAL_META } from '../reversal';
import {
  PICK_STATUS_META,
  nextPickAction,
  recommendPickBins,
  validatePickList,
  pickHasErrors,
} from '../picking';
import { useAuth } from '../../contexts/AuthContext';
import type {
  DispatchRow, DispatchStatus, PickListStatus, TransferPriority, TransferRow, TransferStatus, MovementType,
} from '../types';

type OpsTab = 'receiving' | 'transfers' | 'dispatch' | 'picking' | 'replenishment' | 'cyclecount';

const TABS: { id: OpsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'receiving', label: 'Receiving', icon: <PackagePlus size={13} /> },
  { id: 'transfers', label: 'Transfers', icon: <ArrowLeftRight size={13} /> },
  { id: 'dispatch', label: 'Dispatch', icon: <Truck size={13} /> },
  { id: 'picking', label: 'Picking', icon: <ClipboardCheck size={13} /> },
  { id: 'replenishment', label: 'Replenishment', icon: <RefreshCcw size={13} /> },
  { id: 'cyclecount', label: 'Cycle Count', icon: <ListChecks size={13} /> },
];

const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  receive: 'Receive', transfer_out: 'Transfer Out', transfer_in: 'Transfer In',
  dispatch: 'Dispatch', consolidate: 'Consolidate', overflow: 'Overflow',
  replenish: 'Replenish', adjust: 'Adjust', pick: 'Pick', other: 'Other', reversal: 'Reversal',
};

export default function OperationsPage() {
  const [tab, setTab] = useState<OpsTab>('receiving');
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
              <h1 className="text-sm font-bold text-zinc-900 m-0">Warehouse Operations</h1>
              <div className="text-[10px] text-zinc-400">
                Receiving · internal transfers · replenishment — every movement audited
              </div>
            </div>
          </div>
          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-0.5">
            {TABS.map(t => (
              <Button variant="ghost" size="sm"
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-[11px] font-bold transition-all ${
                  tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                {t.icon} {t.label}
              </Button>
            ))}
          </div>
        </div>

        {tab === 'receiving' && <ReceivingTab />}
        {tab === 'transfers' && <TransfersTab />}
        {tab === 'dispatch' && <DispatchTab />}
        {tab === 'picking' && <PickingTab />}
        {tab === 'replenishment' && <ReplenishmentTab />}
        {tab === 'cyclecount' && <CycleCountTab />}
      </div>
    </div>
  );
}

// ─── Receiving tab (PRD §9.16 put-away suggestions) ─────────────────────────

function ReceivingTab() {
  const { data: warehouses = [], isLoading: loadingWarehouses } = useWarehouses();
  const [warehouseId, setWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState<number | ''>(1);
  const [suggestedBin, setSuggestedBin] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: candidates = [] } = useBinCandidates();
  const { data: assignableItems = [] } = useAssignableItems();
  const receive = useReceiveStock();
  const qtyNum = Number(qty) || 0;

  // ── PO-driven receiving (PRD §4.12) ──
  const [mode, setMode] = useState<'direct' | 'po'>('direct');
  const { data: openPOs = [], isLoading: loadingPOs } = useOpenPurchaseOrders();
  const [selectedPoId, setSelectedPoId] = useState('');
  const [poReceived, setPoReceived] = useState<Record<string, number>>({});
  const [poQtyDraft, setPoQtyDraft] = useState<Record<string, string>>({});
  const selectedPo = openPOs.find(p => p.id === selectedPoId);

  const receivePoLine = (line: { id: string; materialId: string | null }, bin: { id: string; name: string } | undefined, remaining: number) => {
    const raw = poQtyDraft[line.id];
    if (!raw || !line.materialId || !bin) return;
    const qty = Math.min(Number(raw), remaining); // never over-receive a PO line
    if (!Number.isFinite(qty) || qty <= 0 || remaining <= 0) return;
    receive.mutate(
      { binId: bin.id, itemId: line.materialId, quantity: qty },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setPoReceived(r => ({ ...r, [line.id]: (r[line.id] ?? 0) + qty }));
            setMessage({ ok: true, text: `Received ${qty} into ${bin.name} (${line.id.slice(0, 8)}).` });
            setPoQtyDraft(d => { const n = { ...d }; delete n[line.id]; return n; });
          } else {
            setMessage({ ok: false, text: res.error ?? 'Receive failed' });
          }
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Receive failed' }),
      }
    );
  };

  // Bins scoped to the selected warehouse (via the floor/zone chain).
  const warehouseBins = useMemo(() => {
    if (!warehouseId) return [];
    return candidates.filter(c => c.warehouseId === warehouseId);
  }, [candidates, warehouseId]);

  const suggestions = useMemo(() => {
    if (!itemId || qtyNum <= 0) return [];
    return suggestPutaway({
      preferredStorageRole: 'receiving',
      quantity: qtyNum,
      bins: warehouseBins,
    });
  }, [warehouseBins, itemId, qtyNum]);

  const overflow = useMemo(() => {
    if (!itemId || qtyNum <= 0) return null;
    return suggestOverflow('receiving', qtyNum, warehouseBins);
  }, [warehouseBins, itemId, qtyNum]);

  const submit = () => {
    if (!itemId || qtyNum <= 0 || !suggestedBin) return;
    receive.mutate(
      { binId: suggestedBin, itemId, quantity: qtyNum },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setMessage({ ok: true, text: `Received ${qtyNum} into ${warehouseBins.find(b => b.id === suggestedBin)?.name ?? 'bin'}.` });
            setQty(1);
            setItemId('');
            setSuggestedBin('');
          } else {
            setMessage({ ok: false, text: res.error ?? 'Receive failed' });
          }
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Receive failed' }),
      }
    );
  };

  const modeBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'}`;

  return (
    <div className="space-y-3">
      {/* Receive mode (PRD §4.12 — direct or from purchase order) */}
      <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1 w-fit">
        <Button variant="ghost" size="sm" onClick={() => setMode('direct')} className={modeBtn(mode === 'direct')}>Direct receive</Button>
        <Button variant="ghost" size="sm" onClick={() => setMode('po')} className={modeBtn(mode === 'po')}>Receive from PO</Button>
      </div>

      {/* Warehouse picker */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Warehouse</span>
        <select
          value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)}
          className="h-8 pl-2.5 pr-7 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-700 outline-none focus:border-blue-400 max-w-[240px]"
        >
          <option value="">Select warehouse…</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.warehouse_name ?? w.name}</option>
          ))}
        </select>
        {loadingWarehouses && <Loader2 size={12} className="animate-spin text-zinc-400" />}
      </div>

      {mode === 'direct' && (!warehouseId ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-xs text-zinc-400">
          Select a warehouse to begin receiving.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Left: receive form */}
          <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-4">
            <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <PackagePlus size={13} className="text-blue-600" /> Receive Stock
            </h2>
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Item *</label>
                <select
                  value={itemId}
                  onChange={e => setItemId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
                >
                  <option value="">Select item…</option>
                  {assignableItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Quantity *</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={e => setQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs tabular-nums text-zinc-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Put away to *</label>
                <select
                  value={suggestedBin}
                  onChange={e => setSuggestedBin(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
                >
                  <option value="">Choose bin…</option>
                  {suggestions.slice(0, 8).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.storageRole ?? '—'} · {b.currentQty}/{b.maxQuantity ?? '∞'} free {b.freeCapacity === Infinity ? '∞' : b.freeCapacity}
                    </option>
                  ))}
                  {overflow && overflow.candidates.slice(0, 5).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.storageRole ?? '—'} (overflow) · free {b.freeCapacity === Infinity ? '∞' : b.freeCapacity}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="ghost" size="sm"
                onClick={submit}
                disabled={!itemId || qtyNum <= 0 || !suggestedBin || receive.isPending}
                className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
              >
                {receive.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Receive Stock
              </Button>
              {message && (
                <div className={`text-[10.5px] font-semibold rounded-md px-2.5 py-1.5 border ${
                  message.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>

          {/* Right: put-away suggestions */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
                <Search size={12} className="text-blue-600" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Put-away suggestions</span>
                <span className="text-[9.5px] text-zinc-400 ml-auto">Storage-role aware · capacity checked · blocked/reserved excluded</span>
              </div>
              {suggestions.length === 0 ? (
                <div className="p-6 text-center text-[11px] text-zinc-400">
                  {!itemId || qtyNum <= 0
                    ? 'Pick an item and quantity to see suggested bins.'
                    : 'No bin has enough free capacity — see overflow candidates below.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {suggestions.slice(0, 6).map((b, i) => (
                    <div
                      key={b.id}
                      onClick={() => setSuggestedBin(b.id)}
                      className={`px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors ${
                        suggestedBin === b.id ? 'bg-blue-50/70' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9.5px] font-bold ${
                        i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11.5px] font-bold text-zinc-800 font-mono">{b.name}</div>
                        <div className="text-[9.5px] text-zinc-400 truncate">
                          {b.zoneName ?? '—'} · {b.storageRole ?? 'no role'}
                          {b.maxWeightKg ? ` · ≤${b.maxWeightKg} kg` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10.5px] tabular-nums font-semibold text-zinc-700">
                          {b.currentQty}<span className="text-zinc-400">/{b.maxQuantity ?? '∞'}</span>
                        </div>
                        <div className="text-[9px] text-zinc-400">free {b.freeCapacity === Infinity ? '∞' : b.freeCapacity}</div>
                      </div>
                      {suggestedBin === b.id && <CheckCircle2 size={13} className="text-blue-600" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {overflow && overflow.reason !== 'no_matching_role' && overflow.candidates.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                  <AlertTriangle size={11} /> Overflow candidates
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {overflow.candidates.slice(0, 5).map(b => (
                    <Button variant="ghost" size="sm"
                      key={b.id}
                      onClick={() => setSuggestedBin(b.id)}
                      className={`px-2 py-1 rounded-md border text-[10px] font-semibold transition-all ${
                        suggestedBin === b.id
                          ? 'border-amber-400 bg-amber-100 text-amber-800'
                          : 'border-amber-200 bg-white text-amber-700 hover:border-amber-400'
                      }`}
                    >
                      {b.name} · free {b.freeCapacity === Infinity ? '∞' : b.freeCapacity}
                    </Button>
                  ))}
                </div>
                <div className="text-[9.5px] text-amber-600/80 mt-1.5">
                  {overflow.reason === 'capacity_full'
                    ? 'Preferred receiving bins are full — temporary overflow storage recommended (PRD §9.18).'
                    : 'No receiving-role bins available — overflow storage recommended (PRD §9.18).'}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {mode === 'po' && (
        <div className="space-y-3">
          {!warehouseId ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-xs text-zinc-400">
              Select a warehouse to begin receiving.
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
                <PackageCheck size={12} className="text-blue-600" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Receive from Purchase Order</span>
                <span className="text-[9.5px] text-zinc-400 ml-auto">PRD §4.12 — PO lines map to warehouse stock through the Movement Engine</span>
              </div>
              <div className="p-3 flex items-center gap-2 flex-wrap">
                <select
                  value={selectedPoId}
                  onChange={e => { setSelectedPoId(e.target.value); setPoReceived({}); }}
                  className="h-9 pl-2.5 pr-7 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-700 outline-none focus:border-blue-400 max-w-[420px]"
                >
                  <option value="">Select an open purchase order…</option>
                  {openPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.poNumber} · {po.vendorName ?? 'Vendor'} · {po.status}</option>
                  ))}
                </select>
                {loadingPOs && <Loader2 size={12} className="animate-spin text-zinc-400" />}
                {!loadingPOs && openPOs.length === 0 && (
                  <span className="text-[10.5px] text-zinc-400">No open purchase orders (Approved / Sent / Partially Received) in this organisation.</span>
                )}
              </div>

              {selectedPo && (
                <div className="border-t border-zinc-100 overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-50">
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 font-semibold">PO qty</th>
                        <th className="px-3 py-2 font-semibold">Received</th>
                        <th className="px-3 py-2 font-semibold">Suggested bin</th>
                        <th className="px-3 py-2 font-semibold">Qty to receive</th>
                        <th className="px-3 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPo.items.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-4 text-zinc-400 italic text-[11px]">This order has no lines.</td></tr>
                      )}
                      {selectedPo.items.map(line => {
                        const received = poReceived[line.id] ?? 0;
                        const remaining = Math.max(0, (line.quantity ?? 0) - received);
                        const done = line.quantity != null && received >= line.quantity;
                        const draftQty = Number(poQtyDraft[line.id]) || 1;
                        const bin = suggestPutaway({ preferredStorageRole: 'receiving', quantity: draftQty, bins: warehouseBins })[0];
                        return (
                          <tr key={line.id} className="border-t border-zinc-50">
                            <td className="px-3 py-2 font-medium text-zinc-700">
                              {line.itemName ?? 'Item'}{line.unit ? ` (${line.unit})` : ''}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-zinc-600">{line.quantity ?? '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`tabular-nums font-semibold ${done ? 'text-emerald-600' : 'text-zinc-600'}`}>{received}</span>
                              {done && <CheckCircle2 size={12} className="inline ml-1 text-emerald-500" />}
                            </td>
                            <td className="px-3 py-2 text-[10.5px] text-zinc-500">
                              {bin
                                ? `${bin.name} · free ${bin.freeCapacity === Infinity ? '∞' : bin.freeCapacity}`
                                : line.materialId ? '—' : 'no item master'}
                            </td>
                            <td className="px-3 py-2">
                              {done ? (
                                <span className="text-[10px] text-emerald-600 font-semibold">Complete</span>
                              ) : (
                                <input
                                  type="number" min={0} max={remaining}
                                  value={poQtyDraft[line.id] ?? ''}
                                  onChange={e => setPoQtyDraft(d => ({ ...d, [line.id]: e.target.value }))}
                                  placeholder={String(remaining)}
                                  disabled={!line.materialId}
                                  className="w-20 min-h-[28px] px-2 text-[11.5px] border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {!done && line.materialId && (
                                <Button variant="ghost" size="sm"
                                  onClick={() => receivePoLine(line, bin, remaining)}
                                  disabled={!poQtyDraft[line.id] || receive.isPending}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-semibold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
                                >
                                  {receive.isPending ? <Loader2 size={11} className="animate-spin" /> : <PackagePlus size={11} />} Receive
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2.5 border-t border-zinc-100 bg-zinc-50/50 text-[10.5px] text-zinc-500">
                    Every receive writes an audit row through the Movement Engine. Partial receipts are allowed — the tally resets when you switch orders.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Transfers tab (PRD §9.11–§9.13, §9.19, §9.23) ──────────────────────────

function TransfersTab() {
  const { organisation } = useAuth();
  const { data: transfers = [], isLoading } = useTransfers();
  const { data: candidates = [] } = useBinCandidates();
  const { data: assignableItems = [] } = useAssignableItems();
  const createTransfer = useCreateTransfer();
  const advance = useAdvanceTransfer();
  const execute = useExecuteTransfer();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    itemId: '',
    quantity: 1,
    sourceBinId: '',
    destinationBinId: '',
    priority: 'normal' as TransferPriority,
    remarks: '',
  });
  const [formMessage, setFormMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<TransferView | null>(null);
  const [search, setSearch] = useState('');

  const qtyNum = Number(form.quantity) || 0;
  const source = candidates.find(c => c.id === form.sourceBinId) ?? null;
  const destination = candidates.find(c => c.id === form.destinationBinId) ?? null;
  const issues = validateTransfer({
    quantity: qtyNum,
    source: source ?? null,
    destination: destination ?? null,
    destinationCurrentQty: destination?.currentQty ?? 0,
  });
  const formBlocked = hasErrors(issues) || !form.itemId || !form.sourceBinId || !form.destinationBinId;

  const submit = () => {
    if (formBlocked) return;
    createTransfer.mutate(
      {
        itemId: form.itemId,
        quantity: qtyNum,
        sourceBinId: form.sourceBinId,
        destinationBinId: form.destinationBinId,
        priority: form.priority,
        remarks: form.remarks || null,
      },
      {
        onSuccess: () => {
          setFormMessage({ ok: true, text: `Transfer created (${form.priority}).` });
          setShowCreate(false);
          setForm({ itemId: '', quantity: 1, sourceBinId: '', destinationBinId: '', priority: 'normal', remarks: '' });
        },
        onError: (e: unknown) => setFormMessage({ ok: false, text: e instanceof Error ? e.message : 'Create failed' }),
      }
    );
  };

  const runAction = (t: TransferView, to: TransferStatus) => {
    advance.mutate(
      { transferId: t.id, to },
      {
        onError: (e: unknown) => setFormMessage({ ok: false, text: e instanceof Error ? e.message : 'Action failed' }),
      }
    );
  };

  const runExecute = (t: TransferView) => {
    execute.mutate(t.id, {
      onError: (e: unknown) => setFormMessage({ ok: false, text: e instanceof Error ? e.message : 'Execute failed' }),
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return transfers;
    const q = search.trim().toLowerCase();
    return transfers.filter(t =>
      (t.transfer_no ?? '').toLowerCase().includes(q) ||
      (t.sourceBinName ?? '').toLowerCase().includes(q) ||
      (t.destinationBinName ?? '').toLowerCase().includes(q) ||
      (t.itemName ?? '').toLowerCase().includes(q) ||
      t.status.includes(q)
    );
  }, [transfers, search]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transfer, bin, item, status…"
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="text-[10px] text-zinc-400">{filtered.length} transfers</div>
        <Button variant="ghost" size="sm"
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all"
        >
          <Plus size={12} /> New Transfer
        </Button>
      </div>

      {formMessage && (
        <div className={`text-[10.5px] font-semibold rounded-md px-3 py-2 border ${
          formMessage.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
        }`}>
          {formMessage.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ClipboardList size={13} className="text-blue-600" /> New Internal Transfer
            <span className="text-[9.5px] font-semibold text-zinc-400 normal-case ml-auto">
              Create → Validate → Approve → Pick → Move → Confirm (PRD §9.11)
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Item *</label>
              <select
                value={form.itemId}
                onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                <option value="">Select item…</option>
                {assignableItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Quantity *</label>
              <input
                type="number" min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs tabular-nums text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Priority *</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TransferPriority }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                {TRANSFER_PRIORITIES.map(p => (
                  <option key={p} value={p}>{TRANSFER_PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">From (source bin) *</label>
              <select
                value={form.sourceBinId}
                onChange={e => setForm(f => ({ ...f, sourceBinId: e.target.value }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                <option value="">Select source…</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.storageRole ?? '—'} ({c.currentQty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">To (destination bin) *</label>
              <select
                value={form.destinationBinId}
                onChange={e => setForm(f => ({ ...f, destinationBinId: e.target.value }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                <option value="">Select destination…</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.storageRole ?? '—'} (free {c.freeCapacity === Infinity ? '∞' : c.freeCapacity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Remarks</label>
              <input
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Optional note…"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Validation checklist (PRD §9.19) */}
          {issues.length > 0 && (
            <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 space-y-1">
              {issues.map(iss => (
                <div key={iss.code} className={`flex items-center gap-1.5 text-[10.5px] font-medium ${
                  iss.severity === 'error' ? 'text-red-600' : 'text-amber-700'
                }`}>
                  {iss.severity === 'error'
                    ? <XCircle size={11} />
                    : <Info size={11} />}
                  {iss.message}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Button variant="ghost" size="sm"
              onClick={submit}
              disabled={formBlocked || createTransfer.isPending}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send size={12} /> Create Transfer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Transfer list */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <PageSkeleton variant="table" rows={6} />
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-400 italic">No transfers yet.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="px-3 py-2">Transfer</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">From → To</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="text-[11px] font-bold text-zinc-800 font-mono">{t.transfer_no}</div>
                    <div className="text-[9.5px] text-zinc-400">{fmtDate(t.created_at)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-zinc-700 font-medium">{t.itemName ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10.5px]">
                      <span className="font-semibold text-zinc-700 font-mono">{t.sourceBinName ?? '—'}</span>
                      <ArrowLeftRight size={10} className="text-zinc-400" />
                      <span className="font-semibold text-zinc-700 font-mono">{t.destinationBinName ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] tabular-nums font-semibold text-zinc-800">{t.quantity}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold ${TRANSFER_PRIORITY_META[t.priority].badge}`}>
                      {TRANSFER_PRIORITY_META[t.priority].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold ${TRANSFER_STATUS_META[t.status].badge}`}>
                      {TRANSFER_STATUS_META[t.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm"
                        onClick={() => setHistoryFor(t)}
                        title="Movement history"
                        className="p-1.5 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <History size={12} />
                      </Button>
                      <ActionButtons transfer={t} onAdvance={runAction} onExecute={runExecute} busy={advance.isPending || execute.isPending} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {historyFor && (
        <MovementHistoryDrawer
          transfer={historyFor}
          onClose={() => setHistoryFor(null)}
          organisationId={organisation?.id}
        />
      )}
    </div>
  );
}

function ActionButtons({
  transfer,
  onAdvance,
  onExecute,
  busy,
}: {
  transfer: TransferView;
  onAdvance: (t: TransferView, to: TransferStatus) => void;
  onExecute: (t: TransferView) => void;
  busy: boolean;
}) {
  const next = nextTransferAction(transfer.status);
  if (!next) return null;
  return (
    <>
      {transfer.status === 'in_transit' ? (
        <Button variant="ghost" size="sm"
          onClick={() => onExecute(transfer)}
          disabled={busy}
          title="Execute: move stock + audit"
          className="flex items-center gap-1 h-6 px-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold transition-all disabled:opacity-40"
        >
          <CheckCircle2 size={10} /> Execute
        </Button>
      ) : (
        <Button variant="ghost" size="sm"
          onClick={() => onAdvance(transfer, next.to)}
          disabled={busy}
          className="flex items-center gap-1 h-6 px-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[9.5px] font-bold transition-all disabled:opacity-40"
        >
          {next.label}
        </Button>
      )}
      {(transfer.status === 'draft' || transfer.status === 'requested' || transfer.status === 'approved' || transfer.status === 'picking') && (
        <Button variant="ghost" size="sm"
          onClick={() => onAdvance(transfer, 'cancelled')}
          disabled={busy}
          title="Cancel transfer"
          className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <XCircle size={12} />
        </Button>
      )}
    </>
  );
}

// ─── Movement history drawer (PRD §9.23 audit trail) ────────────────────────

function MovementHistoryDrawer({ transfer, onClose, organisationId }: {
  transfer: TransferView;
  onClose: () => void;
  organisationId?: string;
}) {
  const { data: movements = [], isLoading } = useMovements(undefined, transfer.item_id ?? undefined);
  const reverse = useReverseMovement();
  const [confirmFor, setConfirmFor] = useState<{ id: string; label: string } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  // Movement rows BELONGING to this transfer (same reference). Item-matched
  // rows from OTHER references are shown for context but are NOT reversible
  // here — reversing them would undo a different document.
  const related = movements.filter(m => m.reference_id === transfer.id || (m.item_id === transfer.item_id));
  const reversible = related.filter(m => m.reference_id === transfer.id);

  const runReverse = () => {
    if (!confirmFor) return;
    reverse.mutate(confirmFor.id, {
      onSuccess: (res) => {
        if (res.ok) {
          setFeedback({ ok: true, text: `Reversed ${res.reversed ?? 1} movement record${(res.reversed ?? 1) !== 1 ? 's' : ''} — stock restored, audit kept (TAD §5.12).` });
          setConfirmFor(null);
        } else {
          setFeedback({ ok: false, text: res.error ?? 'Reversal failed' });
          setConfirmFor(null);
        }
      },
      onError: (e: unknown) => {
        setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Reversal failed' });
        setConfirmFor(null);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <div className="text-[12px] font-bold text-zinc-900">{transfer.transfer_no}</div>
            <div className="text-[9.5px] text-zinc-400">Movement audit trail</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
            <XCircle size={14} />
          </Button>
        </div>
        <div className="p-4 space-y-2">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status timeline</div>
          {TRANSFER_STATUS_TIMELINE.map(s => (
            <div key={s.status} className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${
                statusPassed(transfer, s.status) ? 'bg-emerald-500' : 'bg-zinc-200'
              }`} />
              <span className={`text-[10.5px] font-semibold ${statusPassed(transfer, s.status) ? 'text-zinc-800' : 'text-zinc-400'}`}>
                {TRANSFER_STATUS_META[s.status].label}
              </span>
              <span className="text-[9px] text-zinc-400 ml-auto">{fmtDate(s.stampFor(transfer))}</span>
            </div>
          ))}

          <div className="border-t border-zinc-100 pt-3 mt-4">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <History size={11} className="text-blue-600" /> Movement records
            </div>
            {isLoading ? (
              <div className="text-[10.5px] text-zinc-400 py-3 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            ) : related.length === 0 ? (
              <div className="text-[10.5px] text-zinc-400 italic py-3">
                No movement records yet — execute the transfer to generate the audit trail.
              </div>
            ) : (
              <div className="space-y-1.5">
                {reversible.length > 0 && (
                  <div className="text-[9.5px] text-zinc-400 px-0.5">
                    Movement records belong to this transfer can be reversed (TAD §5.12) — history is never deleted.
                  </div>
                )}
                {feedback && (
                  <div className={`text-[10px] font-semibold rounded-md px-2.5 py-1.5 border ${
                    feedback.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
                  }`}>
                    {feedback.text}
                  </div>
                )}
                {related.map(m => {
                  const guard = canReverseMovement(m);
                  const isReversal = m.movement_type === 'reversal';
                  return (
                    <div key={m.id} className="rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-700 uppercase tracking-wide">
                          {MOVEMENT_TYPE_LABEL[m.movement_type] ?? m.movement_type}
                          {(isReversal || m.reversed_at) && (
                            <span className={`inline-block px-1 py-0.5 rounded-full border text-[8.5px] font-bold ${REVERSAL_META.reversal.badge}`}>
                              {isReversal ? 'Reversal' : 'Reversed'}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {guard.ok && m.reference_id === transfer.id && (
                            <Button variant="ghost" size="sm"
                              onClick={() => setConfirmFor({ id: m.id, label: `${MOVEMENT_TYPE_LABEL[m.movement_type] ?? m.movement_type} · ${m.quantity}` })}
                              disabled={reverse.isPending}
                              title="Reverse this movement (TAD §5.12)"
                              className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-700 text-[8.5px] font-bold hover:bg-violet-100 transition-all disabled:opacity-40"
                            >
                              Reverse
                            </Button>
                          )}
                          <span className={`text-[10px] tabular-nums font-bold ${m.quantity != null && m.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {m.quantity != null && m.quantity < 0 ? '' : '+'}{m.quantity}
                          </span>
                        </div>
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5">
                        {fmtDateTime(m.created_at)}
                        {m.remarks ? ` · ${m.remarks}` : ''}
                        {m.reversed_at ? ` · reversed ${fmtDateTime(m.reversed_at)}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reverse confirmation (TAD §5.12 — history is never deleted) */}
      {confirmFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirmFor(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
              <RefreshCcw size={14} className="text-violet-600" />
              <span className="text-[12px] font-bold text-zinc-900">Reverse movement</span>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="text-[10.5px] text-zinc-500">
                Reversing <span className="font-bold text-zinc-700">{confirmFor.label}</span> restores stock to the
                source bin (capacity-checked), releases any active reservation, and writes a
                <span className="font-bold text-zinc-700"> reversal audit record</span> — history is never deleted (TAD §5.12).
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm"
                  onClick={runReverse}
                  disabled={reverse.isPending}
                  className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {reverse.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                  Confirm Reversal
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmFor(null)} className="h-9 px-3 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TRANSFER_STATUS_TIMELINE: { status: TransferStatus; stampFor: (t: TransferRow) => string | null | undefined }[] = [
  { status: 'requested', stampFor: t => t.requested_at },
  { status: 'approved', stampFor: t => t.approved_at },
  { status: 'picking', stampFor: t => t.picked_at },
  { status: 'in_transit', stampFor: t => t.in_transit_at },
  { status: 'received', stampFor: t => t.received_at },
  { status: 'completed', stampFor: t => t.completed_at },
];

function statusPassed(t: TransferRow, s: TransferStatus): boolean {
  const order: TransferStatus[] = ['requested', 'approved', 'picking', 'in_transit', 'received', 'completed'];
  const idx = order.indexOf(s);
  if (idx < 0) return false;
  const cur = order.indexOf(t.status);
  return t.status === s || (cur >= idx && t.status !== 'draft' && !['cancelled', 'rejected'].includes(t.status) && cur >= idx);
}

// ─── Dispatch tab (PRD §4.13 queue, TAD §3.13 + §5.11 reservations) ─────────

function DispatchTab() {
  const { data: dispatches = [], isLoading } = useDispatches();
  const { data: candidates = [] } = useBinCandidates();
  const { data: assignableItems = [] } = useAssignableItems();
  const { data: orgBinItems = [] } = useOrgBinItems();
  const createDispatch = useCreateDispatch();
  const advance = useAdvanceDispatch();
  const reserve = useReserveDispatch();
  const release = useReleaseDispatchReserve();
  const execute = useExecuteDispatch();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    salesOrderRef: '',
    itemId: '',
    quantity: 1,
    sourceBinId: '',
    priority: 'normal' as TransferPriority,
    remarks: '',
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shipFor, setShipFor] = useState<DispatchView | null>(null);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');

  const binItems = orgBinItems as Array<{ bin_id: string; item_id: string | null; quantity: number | null }>;
  const qtyNum = Number(form.quantity) || 0;

  // Item quantity in the selected source bin (live from bin items).
  const sourceItemQty = useMemo(() => {
    if (!form.sourceBinId || !form.itemId) return 0;
    return binItems
      .filter(bi => bi.bin_id === form.sourceBinId && bi.item_id === form.itemId)
      .reduce((s, bi) => s + (bi.quantity ?? 0), 0);
  }, [binItems, form.sourceBinId, form.itemId]);

  const source = candidates.find(c => c.id === form.sourceBinId) ?? null;
  const issues = validateDispatch({
    quantity: qtyNum,
    source: source ? {
      id: source.id,
      name: source.name,
      blocked: source.blocked,
      // Bin-level reservations are enforced server-side at reserve time
      // (TAD §5.11); the client checks live available qty vs quantity here.
      reservedQty: 0,
    } : null,
    sourceItemQty,
  });
  const formBlocked = hasDispatchErrors(issues) || !form.itemId || !form.sourceBinId;

  // Dispatch queue grouped per PRD §4.13.
  const queue = useMemo(() => groupDispatchQueue(dispatches), [dispatches]);

  const submit = () => {
    if (formBlocked) return;
    createDispatch.mutate(
      {
        salesOrderRef: form.salesOrderRef || null,
        itemId: form.itemId,
        quantity: qtyNum,
        sourceBinId: form.sourceBinId,
        priority: form.priority,
        remarks: form.remarks || null,
      },
      {
        onSuccess: () => {
          setMessage({ ok: true, text: 'Dispatch created — now reserve stock.' });
          setShowCreate(false);
          setForm({ salesOrderRef: '', itemId: '', quantity: 1, sourceBinId: '', priority: 'normal', remarks: '' });
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Create failed' }),
      }
    );
  };

  const runReserve = (d: DispatchView) => {
    reserve.mutate(d.id, {
      onSuccess: (res) => setMessage(res.ok
        ? { ok: true, text: `${d.dispatch_no} reserved (${d.quantity}).` }
        : { ok: false, text: res.error ?? 'Reserve failed' }),
      onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Reserve failed' }),
    });
  };

  const runAction = (d: DispatchView, to: DispatchStatus) => {
    advance.mutate({ dispatchId: d.id, to }, {
      onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Action failed' }),
    });
  };

  const runCancel = (d: DispatchView) => {
    // Cancelling a dispatch that still reserves stock must release it first
    // (TAD §5.11 — reservations belong to the Movement Engine).
    if (hasActiveReservation(d.status)) {
      release.mutate(d.id, {
        onSuccess: (res) => setMessage(res.ok
          ? { ok: true, text: `${d.dispatch_no} cancelled — reservation released.` }
          : { ok: false, text: res.error ?? 'Cancel failed' }),
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Cancel failed' }),
      });
    } else {
      runAction(d, 'cancelled');
    }
  };

  const runShip = (d: DispatchView) => {
    execute.mutate(
      { dispatchId: d.id, vehicleNo: vehicleNo || null, driverName: driverName || null },
      {
        onSuccess: (res) => {
          if (res.ok) {
            setMessage({ ok: true, text: `${d.dispatch_no} shipped & completed — movement posted.` });
            setShipFor(null);
            setVehicleNo('');
            setDriverName('');
          } else {
            setMessage({ ok: false, text: res.error ?? 'Dispatch failed' });
          }
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Dispatch failed' }),
      }
    );
  };

  const open = dispatches.filter(d => d.status !== 'completed' && d.status !== 'cancelled').length;
  const reservedQty = dispatches.reduce((s, d) => s + (d.status === 'reserved' ? (d.reserved_qty ?? 0) : 0), 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            <Truck size={11} /> {open} open
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
            <Lock size={11} /> {reservedQty} reserved
          </span>
        </div>
        <span className="text-[9.5px] text-zinc-400 ml-auto hidden md:inline">
          Pending SO → Reserved → Picking → Packing → Ready → Loaded → Completed (PRD §4.13)
        </span>
        <Button variant="ghost" size="sm"
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all"
        >
          <Plus size={12} /> New Dispatch
        </Button>
      </div>

      {message && (
        <div className={`text-[10.5px] font-semibold rounded-md px-3 py-2 border ${
          message.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <PackageCheck size={13} className="text-blue-600" /> New Dispatch
            <span className="text-[9.5px] font-semibold text-zinc-400 normal-case ml-auto">
              Reserve → Validate → Pick → Pack → Load → Ship (TAD §3.13)
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Sales order ref</label>
              <input
                value={form.salesOrderRef}
                onChange={e => setForm(f => ({ ...f, salesOrderRef: e.target.value }))}
                placeholder="SO-1024…"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Item *</label>
              <select
                value={form.itemId}
                onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                <option value="">Select item…</option>
                {assignableItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Quantity *</label>
              <input
                type="number" min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs tabular-nums text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">From (source bin) *</label>
              <select
                value={form.sourceBinId}
                onChange={e => setForm(f => ({ ...f, sourceBinId: e.target.value }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                <option value="">Select source…</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.storageRole ?? '—'} ({c.currentQty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Priority *</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TransferPriority }))}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                {TRANSFER_PRIORITIES.map(p => (
                  <option key={p} value={p}>{TRANSFER_PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Remarks</label>
              <input
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Optional note…"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {issues.length > 0 && (
            <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 space-y-1">
              {issues.map(iss => (
                <div key={iss.code} className={`flex items-center gap-1.5 text-[10.5px] font-medium ${
                  iss.severity === 'error' ? 'text-red-600' : 'text-amber-700'
                }`}>
                  {iss.severity === 'error' ? <XCircle size={11} /> : <Info size={11} />}
                  {iss.message}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Button variant="ghost" size="sm"
              onClick={submit}
              disabled={formBlocked || createDispatch.isPending}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send size={12} /> Create Dispatch
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Dispatch queue (PRD §4.13) */}
      {isLoading ? (
        <PageSkeleton variant="table" rows={6} />
      ) : dispatches.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-xs text-zinc-400 italic">
          No dispatches yet — create one to start the queue.
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(group => (
            <div key={group.section} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
                <Truck size={12} className="text-blue-600" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{group.section}</span>
                <span className="text-[9.5px] text-zinc-400 ml-auto">{group.items.length} dispatch{group.items.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="divide-y divide-zinc-50">
                {group.items.map(d => (
                  <div key={d.id} className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-800">
                        <span className="font-mono">{d.dispatch_no}</span>
                        {d.sales_order_ref && (
                          <span className="text-zinc-400 font-normal">· {d.sales_order_ref}</span>
                        )}
                        <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${DISPATCH_STATUS_META[d.status].badge}`}>
                          {DISPATCH_STATUS_META[d.status].label}
                        </span>
                        {d.reserved_qty ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700">
                            <Lock size={9} /> {d.reserved_qty} reserved
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[9.5px] text-zinc-400 mt-0.5 truncate">
                        {d.itemName ?? '—'} · from {d.sourceBinName ?? '—'} · {d.quantity} units
                        {d.vehicle_no ? ` · vehicle ${d.vehicle_no}` : ''}
                        {d.driver_name ? ` · ${d.driver_name}` : ''}
                      </div>
                    </div>
                    <DispatchActions
                      dispatch={d}
                      onReserve={runReserve}
                      onAdvance={runAction}
                      onCancel={runCancel}
                      onShip={d => setShipFor(d)}
                      busy={reserve.isPending || advance.isPending || execute.isPending || release.isPending}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shipment confirmation dialog (TAD §3.13 Shipment Confirmation) */}
      {shipFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShipFor(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
              <PackageCheck size={14} className="text-blue-600" />
              <span className="text-[12px] font-bold text-zinc-900">Ship {shipFor.dispatch_no}</span>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="text-[10.5px] text-zinc-500">
                Confirming shipment posts the <span className="font-bold text-zinc-700">dispatch movement</span> (source bin decremented, audit recorded).
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Vehicle no</label>
                <input
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  placeholder="KA-01-AB-1234"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Driver name</label>
                <input
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="Driver name…"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm"
                  onClick={() => runShip(shipFor)}
                  disabled={execute.isPending}
                  className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {execute.isPending ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />}
                  Confirm Shipment
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShipFor(null)} className="h-9 px-3 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DispatchActions({
  dispatch,
  onReserve,
  onAdvance,
  onCancel,
  onShip,
  busy,
}: {
  dispatch: DispatchView;
  onReserve: (d: DispatchView) => void;
  onAdvance: (d: DispatchView, to: DispatchStatus) => void;
  onCancel: (d: DispatchView) => void;
  onShip: (d: DispatchView) => void;
  busy: boolean;
}) {
  const next = nextDispatchAction(dispatch.status);
  if (!next || dispatch.status === 'completed') return null;

  // 'loaded' is the only status that ships via the RPC (movement posting).
  if (dispatch.status === 'loaded') {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm"
          onClick={() => onShip(dispatch)}
          disabled={busy}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all disabled:opacity-40"
        >
          <PackageCheck size={10} /> Ship & Complete
        </Button>
      </div>
    );
  }

  // Draft status: first action is the RPC reserve (TAD §5.11).
  if (dispatch.status === 'draft') {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm"
          onClick={() => onReserve(dispatch)}
          disabled={busy}
          title="Reserve stock at the source bin"
          className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all disabled:opacity-40"
        >
          <Lock size={10} /> Reserve Stock
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onCancel(dispatch)} disabled={busy} title="Cancel dispatch"
          className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all">
          <XCircle size={12} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm"
        onClick={() => onAdvance(dispatch, next.to)}
        disabled={busy}
        className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition-all disabled:opacity-40"
      >
        {next.label}
      </Button>
      {hasActiveReservation(dispatch.status) && (
        <Button variant="ghost" size="sm"
          onClick={() => onCancel(dispatch)}
          disabled={busy}
          title="Cancel + release reservation"
          className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <XCircle size={12} />
        </Button>
      )}
    </div>
  );
}

// ─── Replenishment tab (PRD §9.14 Bulk → Picking) ───────────────────────────

function ReplenishmentTab() {
  const { organisation } = useAuth();
  const { data: rules = [], isLoading } = useReplenishmentRules();
  const { data: candidates = [] } = useBinCandidates();
  const { data: assignableItems = [] } = useAssignableItems();
  const upsertRule = useUpsertReplenishmentRule();
  const setEnabled = useSetReplenishmentRuleEnabled();
  const deleteRule = useDeleteReplenishmentRule();
  const executeReplenish = useExecuteReplenishment();

  const [ruleForm, setRuleForm] = useState({ binId: '', itemId: '', minQty: 10, maxQty: 50 });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Live (bin, item) quantities for the whole org — single source of truth.
  const { data: orgBinItems = [] } = useOrgBinItems();
  const binItems = orgBinItems as Array<{ bin_id: string; item_id: string | null; quantity: number | null }>;

  // Rule views: enrich with bin name + current qty (from bin items).
  const ruleViews = useMemo(() => {
    const qtyByBinItem = new Map<string, number>();
    for (const bi of binItems) {
      const key = `${bi.bin_id}:${bi.item_id ?? ''}`;
      qtyByBinItem.set(key, (qtyByBinItem.get(key) ?? 0) + (bi.quantity ?? 0));
    }
    const binName = new Map(candidates.map(c => [c.id, c.name]));
    const itemName = new Map(assignableItems.map(i => [i.id, i.name]));
    return rules.map(r => ({
      ruleId: r.id,
      binId: r.bin_id,
      binName: binName.get(r.bin_id) ?? r.bin_id,
      itemId: r.item_id ?? null,
      itemName: r.item_id ? itemName.get(r.item_id) ?? r.item_id : undefined,
      minQty: r.min_qty ?? 0,
      maxQty: r.max_qty ?? 0,
      currentQty: qtyByBinItem.get(`${r.bin_id}:${r.item_id ?? ''}`) ?? 0,
      enabled: r.enabled !== false,
    }));
  }, [rules, candidates, assignableItems, binItems]);

  // Bulk sources: bulk-storage bins holding a specific item, with that
  // item's quantity (matched to the rule's itemId by the engine).
  const bulkSources = useMemo(() => {
    const binName = new Map(candidates.map(c => [c.id, c.name]));
    const bulkBinIds = new Set(
      candidates.filter(c => c.storageRole === 'bulk_storage').map(c => c.id)
    );
    const qtyByKey = new Map<string, number>();
    for (const bi of binItems) {
      if (!bi.item_id || !bulkBinIds.has(bi.bin_id)) continue;
      const key = `${bi.bin_id}:${bi.item_id}`;
      qtyByKey.set(key, (qtyByKey.get(key) ?? 0) + (bi.quantity ?? 0));
    }
    return [...qtyByKey.entries()].map(([key, availableQty]) => {
      const [binId, itemId] = key.split(':');
      return {
        binId,
        binName: binName.get(binId) ?? binId,
        storageRole: 'bulk_storage',
        itemId,
        availableQty,
      };
    });
  }, [candidates, binItems]);

  const needs = useMemo(() => computeReplenishmentNeeds({ rules: ruleViews, bulkBins: bulkSources }), [ruleViews, bulkSources]);

  // Consolidation suggestions (PRD §9.17) from live bin items.
  const consolidations = useMemo(() => {
    const groups = new Map<string, { itemId: string | null; bins: { binId: string; binName: string; currentQty: number; freeCapacity: number }[] }>();
    for (const bi of binItems) {
      const key = bi.item_id ?? '__none__';
      const g = groups.get(key) ?? { itemId: bi.item_id ?? null, bins: [] };
      const c = candidates.find(x => x.id === bi.bin_id);
      if (!c) continue;
      g.bins.push({
        binId: bi.bin_id,
        binName: c.name,
        currentQty: bi.quantity ?? 0,
        freeCapacity: c.freeCapacity === Infinity ? Number.MAX_SAFE_INTEGER : c.freeCapacity,
      });
      groups.set(key, g);
    }
    const itemName = new Map(assignableItems.map(i => [i.id, i.name]));
    return suggestConsolidation(
      [...groups.values()].map(g => ({ itemId: g.itemId, itemName: g.itemId ? itemName.get(g.itemId) : undefined, bins: g.bins }))
    );
  }, [binItems, candidates, assignableItems]);

  const saveRule = () => {
    if (!ruleForm.binId || !ruleForm.itemId || ruleForm.maxQty <= ruleForm.minQty) {
      setMessage({ ok: false, text: 'Pick a bin + item, and set max > min.' });
      return;
    }
    upsertRule.mutate(ruleForm, {
      onSuccess: () => {
        setMessage({ ok: true, text: 'Replenishment rule saved.' });
        setRuleForm({ binId: '', itemId: '', minQty: 10, maxQty: 50 });
      },
      onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Save failed' }),
    });
  };

  const runRefill = (sourceBinId: string, destinationBinId: string, itemId: string, quantity: number) => {
    executeReplenish.mutate(
      { sourceBinId, destinationBinId, itemId, quantity },
      {
        onSuccess: (res) => {
          setMessage(res.ok
            ? { ok: true, text: `Replenished ${quantity} → ${candidates.find(c => c.id === destinationBinId)?.name ?? 'bin'}.` }
            : { ok: false, text: res.error ?? 'Replenish failed' });
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Replenish failed' }),
      }
    );
  };

  return (
    <div className="space-y-3">
      {/* Rule form */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <RefreshCcw size={13} className="text-blue-600" /> Replenishment Rules
          <span className="text-[9.5px] font-semibold text-zinc-400 normal-case ml-auto">
            Picking bin below min → refill from bulk (PRD §9.14)
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Picking bin *</label>
            <select
              value={ruleForm.binId}
              onChange={e => setRuleForm(f => ({ ...f, binId: e.target.value }))}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
            >
              <option value="">Select bin…</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.storageRole ?? '—'}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Item *</label>
            <select
              value={ruleForm.itemId}
              onChange={e => setRuleForm(f => ({ ...f, itemId: e.target.value }))}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
            >
              <option value="">Item…</option>
              {assignableItems.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Min</label>
            <input type="number" min={0} value={ruleForm.minQty}
              onChange={e => setRuleForm(f => ({ ...f, minQty: Math.max(0, Number(e.target.value)) }))}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs tabular-nums outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Max</label>
            <input type="number" min={0} value={ruleForm.maxQty}
              onChange={e => setRuleForm(f => ({ ...f, maxQty: Math.max(0, Number(e.target.value)) }))}
              className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs tabular-nums outline-none focus:border-blue-400" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <Button variant="ghost" size="sm"
            onClick={saveRule}
            disabled={upsertRule.isPending}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40"
          >
            <Plus size={12} /> Save Rule
          </Button>
          {message && (
            <span className={`text-[10.5px] font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>
          )}
        </div>

        {rules.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                  <th className="py-1.5 pr-2">Bin</th>
                  <th className="py-1.5 pr-2">Item</th>
                  <th className="py-1.5 pr-2">Current</th>
                  <th className="py-1.5 pr-2">Min</th>
                  <th className="py-1.5 pr-2">Max</th>
                  <th className="py-1.5 pr-2">State</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {ruleViews.map(r => {
                  const low = r.enabled && r.currentQty < r.minQty;
                  return (
                    <tr key={r.ruleId} className="border-b border-zinc-50 last:border-0">
                      <td className="py-1.5 pr-2 text-[11px] font-bold text-zinc-800 font-mono">{r.binName}</td>
                      <td className="py-1.5 pr-2 text-[11px] text-zinc-600">{r.itemName ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-[11px] tabular-nums font-semibold text-zinc-800">{r.currentQty}</td>
                      <td className="py-1.5 pr-2 text-[11px] tabular-nums text-zinc-500">{r.minQty}</td>
                      <td className="py-1.5 pr-2 text-[11px] tabular-nums text-zinc-500">{r.maxQty}</td>
                      <td className="py-1.5 pr-2">
                        {low ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full border border-red-200 bg-red-50 text-[9.5px] font-bold text-red-600">
                            Needs refill
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[9.5px] font-bold text-emerald-600">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        <Button variant="ghost" size="sm"
                          onClick={() => setEnabled.mutate({ id: r.ruleId, enabled: !r.enabled })}
                          className={`mr-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                            r.enabled ? 'border-zinc-200 text-zinc-500 hover:border-zinc-400' : 'border-zinc-200 text-zinc-400'
                          }`}
                        >
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteRule.mutate(r.ruleId)} className="p-1 rounded text-zinc-300 hover:text-red-500 transition-all">
                          <Trash2 size={11} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Replenishment queue */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
          <RefreshCcw size={12} className="text-blue-600" />
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Replenishment queue</span>
          <span className="text-[9.5px] text-zinc-400 ml-auto">Bins below minimum with available bulk stock</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-[11px] text-zinc-400">Loading rules…</div>
        ) : needs.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-zinc-400 italic">
            {rules.length === 0
              ? 'Add a replenishment rule to see the queue.'
              : 'All picking bins are above their minimums.'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {needs.map(n => (
              <div key={n.rule.ruleId} className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[11.5px] font-bold text-zinc-800 flex items-center gap-1.5">
                    <span className="font-mono">{n.rule.binName}</span>
                    {n.rule.itemName && <span className="text-zinc-400 font-normal">· {n.rule.itemName}</span>}
                    <span className="inline-block px-1.5 py-0.5 rounded-full border border-red-200 bg-red-50 text-[9px] font-bold text-red-600">
                      {n.rule.currentQty} / min {n.rule.minQty}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 mt-0.5">Deficit {n.deficit} · max {n.rule.maxQty}</div>
                </div>
                {n.sources.length === 0 ? (
                  <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={11} /> No bulk stock available
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.sources.slice(0, 3).map(s => (
                      <Button variant="ghost" size="sm"
                        key={s.binId}
                        onClick={() => runRefill(s.binId, n.rule.binId, n.rule.itemId ?? '', Math.min(n.deficit, s.availableQty))}
                        disabled={executeReplenish.isPending}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition-all disabled:opacity-40"
                        title={`Refill ${Math.min(n.deficit, s.availableQty)} from ${s.binName} (${s.availableQty} available)`}
                      >
                        <RefreshCcw size={10} /> Refill from {s.binName} ({s.availableQty})
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consolidation suggestions (PRD §9.17) */}
      {consolidations.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
            <Boxes size={12} className="text-blue-600" />
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Consolidation suggestions</span>
            <span className="text-[9.5px] text-zinc-400 ml-auto">Merge partial bins to free locations (PRD §9.17)</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {consolidations.slice(0, 5).map(c => (
              <div key={c.itemId ?? 'none'} className="px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-bold text-zinc-800 truncate">{c.itemName ?? 'Unknown item'}</div>
                  <div className="text-[9.5px] text-zinc-400">
                    {c.bins.length} bins · {c.bins.map(b => `${b.binName} (${b.currentQty})`).join(', ')}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  Free {c.consolidatableQty} in {c.bins.length - 1} bin{c.bins.length - 1 !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Picking tab (TAD §3.12 pick lists from outbound orders) ────────────────

function PickingTab() {
  const { data: pickLists = [], isLoading } = usePickLists();
  const { data: assignableItems = [] } = useAssignableItems();
  const { data: candidates = [] } = useBinCandidates();
  const { data: orgBinItems = [] } = useOrgBinItems();
  const createPickList = useCreatePickList();
  const advance = useAdvancePickList();
  const updateLineQty = useUpdatePickLineQty();
  const complete = useCompletePickList();

  const [showCreate, setShowCreate] = useState(false);
  const [sourceRef, setSourceRef] = useState('');
  const [priority, setPriority] = useState<TransferPriority>('normal');
  const [lines, setLines] = useState<Array<{ itemId: string; qty: number; binId: string }>>([{ itemId: '', qty: 1, binId: '' }]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lineDrafts, setLineDrafts] = useState<Record<string, string>>({});

  // Merge org bin items (has is_primary/is_reserve/qty) with candidate
  // metadata (name, storage role, zone, blocked) into PickBinCandidate[]
  // keyed by item — the input for recommendPickBins (TAD §3.12).
  const itemBinMap = useMemo(() => {
    const byItem = new Map<string, Array<{
      id: string; name: string; storageRole?: string | null; zoneName?: string | null;
      itemQty: number; isPrimary: boolean; isReserve: boolean; blocked?: boolean | null;
    }>>();
    for (const bi of orgBinItems) {
      if (!bi.item_id || (bi.quantity ?? 0) <= 0) continue;
      const cand = candidates.find(c => c.id === bi.bin_id);
      const entry = {
        id: bi.bin_id,
        name: cand?.name ?? bi.bin_id,
        storageRole: cand?.storageRole ?? null,
        zoneName: cand?.zoneName ?? null,
        itemQty: bi.quantity ?? 0,
        isPrimary: !!bi.is_primary,
        isReserve: !!bi.is_reserve,
        blocked: cand?.blocked ?? false,
      };
      const list = byItem.get(bi.item_id) ?? [];
      list.push(entry);
      byItem.set(bi.item_id, list);
    }
    return byItem;
  }, [orgBinItems, candidates]);

  const lineRecommendations = useMemo(() => {
    return lines.map(l => ({
      itemId: l.itemId,
      bins: l.itemId && Number(l.qty) > 0
        ? recommendPickBins({ itemId: l.itemId, quantity: Number(l.qty), bins: itemBinMap.get(l.itemId) ?? [] })
        : [],
    }));
  }, [lines, itemBinMap]);

  const allLinesValid = lines.every(l => l.itemId && Number(l.qty) > 0 && l.binId);

  const submit = () => {
    if (!allLinesValid) return;
    createPickList.mutate(
      {
        sourceRef: sourceRef || null,
        priority,
        assignedTo: null,
        items: lines.map(l => ({
          itemId: l.itemId,
          sourceBinId: l.binId,
          quantityRequested: Number(l.qty),
        })),
      },
      {
        onSuccess: () => {
          setMessage({ ok: true, text: `Pick list created (${lines.length} line${lines.length !== 1 ? 's' : ''}) — queued for picking.` });
          setShowCreate(false);
          setSourceRef('');
          setPriority('normal');
          setLines([{ itemId: '', qty: 1, binId: '' }]);
        },
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Create failed' }),
      }
    );
  };

  const runAction = (pl: PickListView, to: PickListStatus) => {
    advance.mutate({ pickListId: pl.id, to }, {
      onSuccess: () => setMessage({ ok: true, text: `${pl.pick_no} ${to === 'picking' ? 'started — record picks per line below' : to}.` }),
      onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Action failed' }),
    });
  };

  // Effective picked qty per line = uncommitted draft overlaid on the
  // committed row. Both validation and the RPC must see the same numbers
  // (the operator's freshly typed values), not stale committed ones.
  const effectiveLines = useMemo(() => {
    const map = new Map<string, { id: string; itemId: string | null; sourceBinId: string; quantityRequested: number; quantityPicked: number }>();
    for (const pl of pickLists) {
      for (const i of pl.items) {
        const draft = lineDrafts[i.id];
        map.set(i.id, {
          id: i.id,
          itemId: i.itemId,
          sourceBinId: i.sourceBinId,
          quantityRequested: i.quantityRequested,
          quantityPicked: draft === undefined ? i.quantityPicked : Math.max(0, Number(draft) || 0),
        });
      }
    }
    return map;
  }, [pickLists, lineDrafts]);

  const runComplete = (pl: PickListView) => {
    // Flush any dirty drafts FIRST (mutateAsync so we wait for them to
    // persist), then validate + complete against the committed rows the
    // RPC will actually read. Prevents the RPC decrementing stale qty.
    const dirty = pl.items.filter(i => {
      const draft = lineDrafts[i.id];
      return draft !== undefined && (Number(draft) || 0) !== (i.quantityPicked ?? 0);
    });
    const flush = async () => {
      if (dirty.length > 0) {
        await Promise.all(dirty.map(i => updateLineQty.mutateAsync({ lineId: i.id, quantityPicked: Math.max(0, Number(lineDrafts[i.id]) || 0) })));
      }
      // Client-side pick validation (TAD §3.12) on the now-committed rows;
      // the RPC re-validates + executes each line via the Movement Engine.
      const linesForValidation = pl.items.map(i => ({
        id: i.id,
        itemId: i.itemId,
        sourceBinId: i.sourceBinId,
        quantityRequested: i.quantityRequested,
        quantityPicked: i.quantityPicked,
      }));
      const validations = validatePickList({
        lines: linesForValidation,
        bins: [...itemBinMap.values()].flat(),
      });
      if (pickHasErrors(validations)) {
        setMessage({ ok: false, text: 'Fix validation errors before completing the pick.' });
        return;
      }
      complete.mutate(pl.id, {
        onSuccess: (res) => setMessage(res.ok
          ? { ok: true, text: `${pl.pick_no} completed — ${res.picked ?? 0} picked, ${res.skipped ?? 0} skipped. Stock audited.` }
          : { ok: false, text: res.error ?? 'Complete failed' }),
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Complete failed' }),
      });
    };
    flush();
  };

  const commitLineQty = (lineId: string, qty: number) => {
    setLineDrafts(d => ({ ...d, [lineId]: String(qty) }));
    updateLineQty.mutate(
      { lineId, quantityPicked: Math.max(0, qty) },
      {
        onError: (e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Update failed' }),
      }
    );
  };

  const open = pickLists.filter(p => p.status === 'queued' || p.status === 'picking').length;
  const queue = useMemo(() => {
    const order: PickListStatus[] = ['queued', 'picking', 'completed', 'cancelled'];
    return order
      .map(status => ({ status, items: pickLists.filter(p => p.status === status) }))
      .filter(g => g.items.length > 0);
  }, [pickLists]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            <ClipboardCheck size={11} /> {open} open
          </span>
        </div>
        <span className="text-[9.5px] text-zinc-400 ml-auto hidden md:inline">
          Queued → Picking → Completed — bins recommended (picking role first), every pick audited (TAD §3.12)
        </span>
        <Button variant="ghost" size="sm"
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all"
        >
          <Plus size={12} /> New Pick List
        </Button>
      </div>

      {message && (
        <div className={`text-[10.5px] font-semibold rounded-md px-3 py-2 border ${
          message.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ClipboardList size={13} className="text-blue-600" /> New Pick List
            <span className="text-[9.5px] font-semibold text-zinc-400 normal-case ml-auto">
              From outbound orders · bins recommended by picking role → primary → availability (TAD §3.12)
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Source ref</label>
              <input
                value={sourceRef}
                onChange={e => setSourceRef(e.target.value)}
                placeholder="SO-1024 / Dispatch ref…"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 block mb-1">Priority *</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TransferPriority)}
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400"
              >
                {TRANSFER_PRIORITIES.map(p => (
                  <option key={p} value={p}>{TRANSFER_PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items with recommended bins */}
          <div className="mt-3 space-y-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Lines *</div>
            {lines.map((line, idx) => {
              const recs = lineRecommendations[idx]?.bins ?? [];
              return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5">
                  <div className="md:col-span-4">
                    <label className="text-[9.5px] font-semibold text-zinc-400 block mb-1">Item *</label>
                    <select
                      value={line.itemId}
                      onChange={e => {
                        const itemId = e.target.value;
                        setLines(ls => ls.map((l, i) => i === idx ? { ...l, itemId, binId: '' } : l));
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-800 outline-none focus:border-blue-400"
                    >
                      <option value="">Select item…</option>
                      {assignableItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name}{i.code ? ` (${i.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9.5px] font-semibold text-zinc-400 block mb-1">Qty *</label>
                    <input
                      type="number" min={1}
                      value={line.qty}
                      onChange={e => {
                        const qty = Math.max(1, Number(e.target.value) || 1);
                        setLines(ls => ls.map((l, i) => i === idx ? { ...l, qty, binId: l.binId && recs.some(r => r.id === l.binId) ? l.binId : '' } : l));
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 text-[11px] tabular-nums text-zinc-800 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="text-[9.5px] font-semibold text-zinc-400 block mb-1">Pick from (recommended) *</label>
                    <select
                      value={line.binId}
                      onChange={e => setLines(ls => ls.map((l, i) => i === idx ? { ...l, binId: e.target.value } : l))}
                      disabled={!line.itemId}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-800 outline-none focus:border-blue-400 disabled:opacity-40"
                    >
                      <option value="">
                        {recs.length === 0 ? (line.itemId ? 'No bin with enough stock' : 'Pick an item first…') : 'Choose recommended bin…'}
                      </option>
                      {recs.slice(0, 6).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} · {b.storageRole ?? '—'} · {b.itemQty} avail{b.isPrimary ? ' · primary' : ''}{b.isReserve ? ' · reserve' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button variant="ghost" size="sm"
                      onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls)}
                      disabled={lines.length === 1}
                      title="Remove line"
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button variant="ghost" size="sm"
              onClick={() => setLines(ls => [...ls, { itemId: '', qty: 1, binId: '' }])}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-blue-300 hover:text-blue-600 transition-all"
            >
              <Plus size={12} /> Add line
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button variant="ghost" size="sm"
              onClick={submit}
              disabled={!allLinesValid || createPickList.isPending}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send size={12} /> Create Pick List
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-zinc-200 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Pick list queue grouped by status */}
      {isLoading ? (
        <PageSkeleton variant="table" rows={6} />
      ) : pickLists.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-xs text-zinc-400 italic">
          No pick lists yet — create one to start picking (TAD §3.12).
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(group => (
            <div key={group.status} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
                <ClipboardCheck size={12} className="text-blue-600" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{PICK_STATUS_META[group.status].label}</span>
                <span className="text-[9.5px] text-zinc-400 ml-auto">{group.items.length} pick list{group.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-zinc-50">
                {group.items.map(pl => {
                  const isOpen = expanded === pl.id;
                  const canStart = pl.status === 'queued';
                  const canPick = pl.status === 'picking';
                  const validations = canPick ? validatePickList({
                    lines: pl.items.map(i => {
                      const eff = effectiveLines.get(i.id);
                      return {
                        id: i.id, itemId: i.itemId, sourceBinId: i.sourceBinId,
                        quantityRequested: i.quantityRequested,
                        quantityPicked: eff ? eff.quantityPicked : i.quantityPicked,
                      };
                    }),
                    bins: [...itemBinMap.values()].flat(),
                  }) : [];
                  const hasErrors = pickHasErrors(validations);
                  const next = nextPickAction(pl.status);
                  return (
                    <div key={pl.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="ghost" size="sm"
                          onClick={() => setExpanded(isOpen ? null : pl.id)}
                          className="flex-1 min-w-[220px] text-left"
                        >
                          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-800">
                            <span className="font-mono">{pl.pick_no}</span>
                            {pl.source_ref && <span className="text-zinc-400 font-normal">· {pl.source_ref}</span>}
                            <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${TRANSFER_PRIORITY_META[pl.priority].badge}`}>
                              {TRANSFER_PRIORITY_META[pl.priority].label}
                            </span>
                          </div>
                          <div className="text-[9.5px] text-zinc-400 mt-0.5">
                            {pl.items.length} line{pl.items.length !== 1 ? 's' : ''} · {pl.items.reduce((s, i) => s + i.quantityRequested, 0)} units requested · {pl.items.reduce((s, i) => s + i.quantityPicked, 0)} picked
                          </div>
                        </Button>
                        <div className="flex items-center gap-1">
                          {canPick && hasErrors && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <AlertTriangle size={9} /> Fix {validations.reduce((s, v) => s + v.issues.length, 0)} issue{validations.reduce((s, v) => s + v.issues.length, 0) !== 1 ? 's' : ''}
                            </span>
                          )}
                          {canStart && next && (
                            <Button variant="ghost" size="sm"
                              onClick={() => runAction(pl, next.to)}
                              disabled={advance.isPending}
                              className="flex items-center gap-1 h-6 px-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[9.5px] font-bold transition-all disabled:opacity-40"
                            >
                              {next.label}
                            </Button>
                          )}
                          {canPick && (
                            <Button variant="ghost" size="sm"
                              onClick={() => runComplete(pl)}
                              disabled={complete.isPending || updateLineQty.isPending}
                              title={hasErrors ? 'Resolve validation errors first' : 'Complete pick — stock decremented + audited'}
                              className="flex items-center gap-1 h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold transition-all disabled:opacity-40"
                            >
                              <CheckCircle2 size={10} /> Complete Pick
                            </Button>
                          )}
                          {(canStart || canPick) && (
                            <Button variant="ghost" size="sm"
                              onClick={() => runAction(pl, 'cancelled')}
                              disabled={advance.isPending}
                              title="Cancel pick list"
                              className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
                              <XCircle size={12} />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm"
                            onClick={() => setExpanded(isOpen ? null : pl.id)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
                          >
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded lines */}
                      {isOpen && (
                        <div className="mt-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50 overflow-hidden">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                                <th className="px-2.5 py-1.5">Item</th>
                                <th className="px-2.5 py-1.5">From (bin)</th>
                                <th className="px-2.5 py-1.5 text-right">Requested</th>
                                <th className="px-2.5 py-1.5 text-right">Picked</th>
                                <th className="px-2.5 py-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody>                {pl.items.map(line => {
                const eff = effectiveLines.get(line.id) ?? {
                  id: line.id, itemId: line.itemId, sourceBinId: line.sourceBinId,
                  quantityRequested: line.quantityRequested, quantityPicked: line.quantityPicked,
                };
                const lineValidation = canPick
                  ? validations.find(v => v.lineId === line.id)?.issues ?? []
                  : [];
                const binMeta = candidates.find(c => c.id === line.sourceBinId);
                                return (
                                  <tr key={line.id} className="border-b border-zinc-50 last:border-0">
                                    <td className="px-2.5 py-2 text-[10.5px] font-semibold text-zinc-700">
                                      {line.itemName ?? '—'}
                                    </td>
                                    <td className="px-2.5 py-2 text-[10.5px] font-mono text-zinc-600">
                                      {line.sourceBinName ?? '—'}
                                      {binMeta?.storageRole ? <span className="text-[9px] text-zinc-400 font-sans"> · {binMeta.storageRole}</span> : null}
                                    </td>
                                    <td className="px-2.5 py-2 text-right text-[10.5px] tabular-nums font-semibold text-zinc-700">
                                      {line.quantityRequested}
                                    </td>
                                    <td className="px-2.5 py-2 text-right">
                                      {canPick ? (
                                        <input
                                          type="number" min={0}
                                          value={lineDrafts[line.id] ?? String(line.quantityPicked ?? 0)}
                                          onChange={e => setLineDrafts(d => ({ ...d, [line.id]: e.target.value }))}
                                          onBlur={e => commitLineQty(line.id, Number(e.target.value) || 0)}
                                          className="w-20 h-7 px-2 rounded-md border border-zinc-200 bg-white text-[10.5px] tabular-nums text-zinc-800 text-right outline-none focus:border-blue-400"
                                        />
                                      ) : (
                                        <span className="text-[10.5px] tabular-nums font-semibold text-zinc-700">
                                          {line.quantityPicked}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2">
                                      <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[8.5px] font-bold ${
                                        line.status === 'picked'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                                      }`}>
                                        {line.status}
                                      </span>
                                      {lineValidation.map(v => (
                                        <span key={v.code} className="block text-[8.5px] font-semibold text-amber-700 mt-0.5">
                                          {v.message}
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtDateTime(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Phase 7 — Cycle Count (PRD §4.21) ───────────────────────────────────────

const ABC_BADGE: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-rose-50 text-rose-600 border-rose-200',
  B: 'bg-amber-50 text-amber-700 border-amber-200',
  C: 'bg-sky-50 text-sky-600 border-sky-200',
};

const ITEM_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-50 text-zinc-500 border-zinc-200',
  counted: 'bg-blue-50 text-blue-700 border-blue-200',
  matched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  variance: 'bg-amber-50 text-amber-700 border-amber-200',
  investigated: 'bg-violet-50 text-violet-700 border-violet-200',
  adjusted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function CycleCountTab() {
  const { data: batches = [], isLoading } = useCycleCounts();
  const { data: warehouses = [] } = useWarehouses();
  const { data: structure } = useOrgStructure();
  const { data: bins = [] } = useBinCandidates();

  const createBatch = useCreateCycleCountBatch();
  const freeze = useFreezeCycleScope();
  const unfreeze = useUnfreezeCycleScope();
  const submitItem = useSubmitCycleCountItem();
  const approve = useApproveCycleCountBatch();
  const cancel = useCancelCycleCountBatch();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countDraft, setCountDraft] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<{ batchId: string; text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    name: '',
    abcClass: 'A' as 'A' | 'B' | 'C',
    scopeType: 'warehouse' as 'warehouse' | 'zone' | 'bin',
    scopeId: '',
    plannedFor: '',
    notes: '',
  });

  const zoneOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const z of structure?.zones ?? []) {
      const key = `${z.name} · ${z.floor_id.slice(0, 8)}`;
      if (!seen.has(key)) seen.set(key, { id: z.id, label: key });
    }
    return [...seen.values()];
  }, [structure]);

  const scopeOptions = useMemo(() => {
    if (form.scopeType === 'warehouse') {
      return warehouses.map(w => ({ id: w.id, label: w.warehouse_name ?? w.name ?? w.id }));
    }
    if (form.scopeType === 'zone') return zoneOptions;
    return bins.map(b => ({ id: b.id, label: b.name }));
  }, [form.scopeType, warehouses, zoneOptions, bins]);

  const effectiveScopeId = form.scopeId || scopeOptions[0]?.id || '';

  const groups = useMemo(() => {
    const g = new Map<string, CycleCountBatchView[]>();
    for (const s of CYCLE_QUEUE_ORDER) g.set(s, []);
    for (const b of batches) {
      const l = g.get(b.status) ?? [];
      l.push(b);
      g.set(b.status, l);
    }
    return [...g.entries()];
  }, [batches]);

  const pendingLines = (b: CycleCountBatchView) => b.items.filter(i => i.counted_qty == null).length;

  const submitForm = async () => {
    if (!effectiveScopeId || createBatch.isPending) return;
    const res = await createBatch.mutateAsync({
      name: form.name || `Cycle Count · ${form.abcClass} · ${new Date().toLocaleDateString('en-GB')}`,
      abcClass: form.abcClass,
      scopeType: form.scopeType,
      scopeId: effectiveScopeId,
      plannedFor: form.plannedFor || null,
      notes: form.notes || null,
    });
    setActionMsg({ batchId: res.batchId ?? 'new', text: res.ok ? `Batch created — ${res.itemCount ?? 0} lines` : (res.error ?? 'Failed'), ok: !!res.ok });
    setShowForm(false);
    setForm({ name: '', abcClass: 'A', scopeType: 'warehouse', scopeId: '', plannedFor: '', notes: '' });
  };

  const submitCount = async (line: CycleCountBatchView['items'][number], batchId: string) => {
    const raw = countDraft[line.id];
    if (raw === undefined || raw === '' || submitItem.isPending) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    const res = await submitItem.mutateAsync({ lineId: line.id, countedQty: qty });
    setActionMsg({ batchId, text: res.ok ? `Count saved · variance ${res.variance ?? 0}` : (res.error ?? 'Failed'), ok: !!res.ok });
    setCountDraft(d => { const n = { ...d }; delete n[line.id]; return n; });
  };

  const runApprove = async (b: CycleCountBatchView) => {
    const res = await approve.mutateAsync(b.id);
    setActionMsg({ batchId: b.id, text: res.ok ? `Approved — ${res.adjusted ?? 0} adjusted, ${res.matched ?? 0} matched` : (res.error ?? 'Failed'), ok: !!res.ok });
  };

  const runCancel = async (b: CycleCountBatchView) => {
    const res = await cancel.mutateAsync(b.id);
    setActionMsg({ batchId: b.id, text: res.ok ? 'Batch cancelled' : (res.error ?? 'Failed'), ok: !!res.ok });
  };

  const runFreeze = async (b: CycleCountBatchView) => {
    const res = await freeze.mutateAsync(b.id);
    setActionMsg({ batchId: b.id, text: res.ok ? 'Scope frozen — start counting' : (res.error ?? 'Failed'), ok: !!res.ok });
  };

  const runUnfreeze = async (b: CycleCountBatchView) => {
    const res = await unfreeze.mutateAsync(b.id);
    setActionMsg({ batchId: b.id, text: res.ok ? 'Scope unfrozen' : (res.error ?? 'Failed'), ok: !!res.ok });
  };

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-semibold rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-zinc-800">Cycle Count</h3>
          <p className="text-[11px] text-zinc-500">ABC-classified blind counts with variance review + approval (PRD §4.21).</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
          <Plus size={13} /> {showForm ? 'Close form' : 'New Cycle Count'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <label className="col-span-2 text-[11px] text-zinc-600">
              Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={`Cycle Count · ${form.abcClass}`} className="mt-1 w-full min-h-[32px] px-2 text-[12px] border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="text-[11px] text-zinc-600">
              ABC class
              <select value={form.abcClass} onChange={e => setForm({ ...form, abcClass: e.target.value as 'A' | 'B' | 'C' })} className="mt-1 w-full min-h-[32px] px-2 text-[12px] border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="A">A — fast movers</option>
                <option value="B">B — medium</option>
                <option value="C">C — slow movers</option>
              </select>
            </label>
            <label className="text-[11px] text-zinc-600">
              Scope
              <select value={form.scopeType} onChange={e => setForm({ ...form, scopeType: e.target.value as 'warehouse' | 'zone' | 'bin', scopeId: '' })} className="mt-1 w-full min-h-[32px] px-2 text-[12px] border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="warehouse">Warehouse</option>
                <option value="zone">Zone</option>
                <option value="bin">Single bin</option>
              </select>
            </label>
            <label className="text-[11px] text-zinc-600">
              {form.scopeType === 'warehouse' ? 'Warehouse' : form.scopeType === 'zone' ? 'Zone' : 'Bin'}
              <select value={effectiveScopeId} onChange={e => setForm({ ...form, scopeId: e.target.value })} className="mt-1 w-full min-h-[32px] px-2 text-[12px] border border-zinc-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                {scopeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-zinc-600">
              Planned for
              <input type="date" value={form.plannedFor} onChange={e => setForm({ ...form, plannedFor: e.target.value })} className="mt-1 w-full min-h-[32px] px-2 text-[12px] border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </label>
          </div>
          <label className="block text-[11px] text-zinc-600">
            Notes
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Scope rationale, expected issues, instructions for the counter…" className="mt-1 w-full px-2 py-1.5 text-[12px] border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={submitForm} disabled={!effectiveScopeId || createBatch.isPending} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold rounded bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {createBatch.isPending ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />} Create batch
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <PageSkeleton variant="list" rows={6} />
      ) : groups.every(([, l]) => l.length === 0) ? (
        <div className="text-[12px] text-zinc-400 italic py-8 text-center">No cycle counts yet — create your first batch.</div>
      ) : (
        groups.map(([status, list]) => (
          <div key={status} className={list.length === 0 ? 'hidden' : ''}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{CYCLE_STATUS_META[status as keyof typeof CYCLE_STATUS_META]?.label ?? status}</span>
              <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 rounded-full">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map(b => (
                <div key={b.id} className="bg-white rounded-lg border border-zinc-200 shadow-sm">
                  <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)} className="text-zinc-400 hover:text-zinc-600" aria-label="Expand">
                      {expandedId === b.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </Button>
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold text-zinc-800">{b.batch_no}</span>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${ABC_BADGE[b.abc_class]}`}>{b.abc_class}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${CYCLE_STATUS_META[b.status]?.badge ?? ''}`}>{CYCLE_STATUS_META[b.status]?.label ?? b.status}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {b.name} · {b.scopeLabel ?? b.scope_type} · {pendingLines(b)}/{b.items.length} lines pending
                        {b.planned_for ? ` · due ${new Date(b.planned_for).toLocaleDateString('en-GB')}` : ''}
                      </div>
                    </div>
                    {actionMsg && actionMsg.batchId === b.id && (
                      <span className={`text-[10.5px] ${actionMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{actionMsg.text}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {b.status === 'scheduled' && canFreeze(b.status) && (
                        <Button variant="ghost" size="sm" onClick={() => runFreeze(b)} disabled={freeze.isPending} className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
                          {freeze.isPending ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Start count
                        </Button>
                      )}
                      {b.status === 'in_progress' && (
                        <Button variant="ghost" size="sm" onClick={() => runUnfreeze(b)} disabled={unfreeze.isPending} className={`${btn} border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50`}>
                          <Unlock size={11} /> Unfreeze
                        </Button>
                      )}
                      {canApprove(b.status, pendingLines(b)) && (
                        <Button variant="ghost" size="sm" onClick={() => runApprove(b)} disabled={approve.isPending} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                          {approve.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve
                        </Button>
                      )}
                      {canCancel(b.status) && (
                        <Button variant="ghost" size="sm" onClick={() => runCancel(b)} disabled={cancel.isPending} className={`${btn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}>
                          <XCircle size={11} /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  {expandedId === b.id && (
                    <div className="border-t border-zinc-100 overflow-x-auto">
                      <table className="w-full text-[11.5px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-50">
                            <th className="px-4 py-2 font-semibold">Bin</th>
                            <th className="px-3 py-2 font-semibold">Item</th>
                            <th className="px-3 py-2 font-semibold">Expected</th>
                            <th className="px-3 py-2 font-semibold">Counted</th>
                            <th className="px-3 py-2 font-semibold">Variance</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold" />
                          </tr>
                        </thead>
                        <tbody>
                          {b.items.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-3 text-zinc-400 italic text-[11px]">Batch scope has no stocked bins — approve to close it.</td></tr>
                          )}
                          {b.items.map(line => {
                            const counted = line.counted_qty != null;
                            return (
                              <tr key={line.id} className="border-t border-zinc-50">
                                <td className="px-4 py-2 font-medium text-zinc-700">{line.binName ?? '—'}</td>
                                <td className="px-3 py-2 text-zinc-600">{line.itemName ?? 'Empty bin'}</td>
                                <td className="px-3 py-2 tabular-nums text-zinc-500">{counted ? (line.expected_qty ?? 0) : '·'}</td>
                                <td className="px-3 py-2">
                                  {counted ? (
                                    <span className="tabular-nums font-medium text-zinc-700">{line.counted_qty}</span>
                                  ) : (
                                    <input
                                      type="number" min={0}
                                      value={countDraft[line.id] ?? ''}
                                      onChange={e => setCountDraft(d => ({ ...d, [line.id]: e.target.value }))}
                                      placeholder="Blind count"
                                      className="w-20 min-h-[28px] px-2 text-[11.5px] border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {counted ? (
                                    <span className={`tabular-nums font-semibold ${line.variance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {(line.variance ?? 0) > 0 ? '+' : ''}{line.variance}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded border ${ITEM_STATUS_BADGE[line.status] ?? 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>{line.status}</span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {!counted && (
                                    <Button variant="ghost" size="sm" onClick={() => submitCount(line, b.id)} disabled={!countDraft[line.id] || submitItem.isPending} className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
                                      {submitItem.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10.5px] text-zinc-500">Approval adjusts stock through the Movement Engine — a reversal-compatible audit row per variance line.</span>
                        {b.items.some(i => i.status === 'variance') && (
                          <span className="text-[10.5px] text-amber-600 font-medium">{b.items.filter(i => i.status === 'variance').length} line(s) with variance need review</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

