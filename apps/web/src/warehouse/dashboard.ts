// src/warehouse/dashboard.ts
// Phase 5 — Dashboard & Operations Workspace. Pure Dashboard Engine.
//
// TAD §2.15 (Dashboard Architecture): the dashboard shall never query every
// module independently. Instead: Dashboard Engine → Aggregates Data →
// Calculates KPIs → Returns Dashboard ViewModel.
// TAD §3.16 (Dashboard Module): the UI never calculates business logic — it
// consumes this engine. Everything here is deterministic + unit-tested.
//
// Implements PRD §2.5 Dashboard Sections:
//   Top: Warehouse Summary · Quick Search · Today's Tasks · Quick Actions · AI Recommendations
//   Operations: Pending Replenishment · Pending Transfers · Receiving · Dispatch ·
//               Cycle Count · Quality Hold queues
//   Warehouse: Heat Map · Storage Utilization · Zone Utilization · Most Congested Zones ·
//              Warehouse Activity
//   Insights: Fast/Slow Moving · Frequently Picked · Unused Storage · Warehouse Efficiency

import { computeBinOccupancy, aggregateCapacity } from './viewer/occupancy';
import {
  computeReplenishmentNeeds,
  suggestConsolidation,
  TRANSFER_STATUS_META,
  TRANSFER_PRIORITY_META,
} from './operations';
import { DISPATCH_STATUS_META, DISPATCH_QUEUE_ORDER } from './dispatch';
import { PICK_STATUS_META } from './picking';
import { CYCLE_STATUS_META } from './cycleCount';
import type { TransferPriority } from './types';

// ─── Inputs (raw rows from the service layer) ────────────────────────────────

export interface DashboardBin {
  id: string;
  name: string;
  warehouseId?: string | null;
  zoneName?: string | null;
  storageRole?: string | null;
  maxQuantity?: number | null;
  currentQty?: number;
  freeCapacity?: number;
  blocked?: boolean;
  reserved?: boolean;
  qualityHold?: boolean;
  status?: string | null;
}

export interface DashboardBinItem {
  bin_id: string;
  item_id: string | null;
  quantity: number | null;
  is_primary?: boolean;
  is_reserve?: boolean;
}

export interface DashboardMovement {
  id: string;
  movement_type: string;
  reference_type: string;
  reference_id?: string | null;
  item_id?: string | null;
  source_bin_id?: string | null;
  destination_bin_id?: string | null;
  quantity?: number | null;
  remarks?: string | null;
  created_at?: string;
}

export interface DashboardTransfer {
  id: string;
  transfer_no?: string | null;
  status: string;
  priority: TransferPriority;
  itemName?: string | null;
  sourceBinName?: string | null;
  destinationBinName?: string | null;
  quantity?: number | null;
  created_at?: string;
}

export interface DashboardDispatch {
  id: string;
  dispatch_no?: string | null;
  status: string;
  priority: TransferPriority;
  itemName?: string | null;
  sourceBinName?: string | null;
  sales_order_ref?: string | null;
  quantity?: number | null;
  created_at?: string;
}

export interface DashboardPickList {
  id: string;
  pick_no?: string | null;
  status: string;
  priority: TransferPriority;
  source_ref?: string | null;
  itemName?: string | null;
  created_at?: string;
}

export interface DashboardReplenishmentRule {
  ruleId: string;
  binId: string;
  binName: string;
  itemId: string | null;
  itemName?: string;
  minQty: number;
  maxQty: number;
  currentQty: number;
  enabled: boolean;
}

export interface DashboardInput {
  warehouses: Array<{ id: string; name?: string | null; warehouse_name?: string | null }>;
  bins: DashboardBin[];
  binItems: DashboardBinItem[];
  movements: DashboardMovement[];
  transfers: DashboardTransfer[];
  dispatches: DashboardDispatch[];
  pickLists: DashboardPickList[];
  replenishmentRules: DashboardReplenishmentRule[];
  /** Phase 7 — cycle-count batches for the queue (empty = none). */
  cycleCounts?: Array<{
    id: string;
    label: string;
    status: string;
    itemCount: number;
    countedCount: number;
    varianceCount: number;
    scheduledFor?: string | null;
  }>;
  /** item id → display name (resolved by the service layer). */
  itemNames?: Map<string, string>;
  /** Movement window for fast/slow moving (days). Default 14. */
  movingWindowDays?: number;
}

// ─── ViewModel ───────────────────────────────────────────────────────────────

export interface SummaryStats {
  warehouseCount: number;
  binCount: number;
  configuredBinCount: number;
  totalUnits: number;
  distinctItems: number;
  occupancyPct: number;
  occupancyLabel: string;
  occupancyColor: string;
  openTransfers: number;
  openDispatches: number;
  queuedPickLists: number;
  replenishmentNeeds: number;
}

export interface TaskItem {
  id: string;
  icon: 'replenish' | 'approve' | 'dispatch' | 'pick' | 'quality' | 'overflow' | 'consolidate';
  title: string;
  detail: string;
  count: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface QueueSection {
  id: string;
  label: string;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    meta?: string;
    badge?: string;
    badgeClass?: string;
    action?: string;
  }>;
  emptyText?: string;
}

export interface ZoneUtilization {
  zoneName: string;
  storageRole?: string | null;
  binCount: number;
  configuredBinCount: number;
  currentQty: number;
  maxQty: number;
  pct: number;
  label: string;
  color: string;
  congested: boolean;
}

export interface HeatCell {
  binId: string;
  binName: string;
  pct: number;
  level: string;
  color: string;
  label: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  typeLabel: string;
  sign: string;
  quantity: number;
  itemName?: string | null;
  binName?: string | null;
  remarks?: string | null;
  at: string | null;
}

export interface MovingItem {
  itemId: string | null;
  itemName?: string | null;
  movementCount: number;
  netQty: number;
}

export interface Recommendation {
  id: string;
  kind: 'alert' | 'action' | 'info';
  title: string;
  detail: string;
}

// ─── Stock Alerts (PRD §4.16) ───────────────────────────────────────────────

export type StockAlertKind =
  | 'low_picking'
  | 'bin_full'
  | 'bin_blocked'
  | 'no_movement'
  | 'quality_hold'
  | 'cycle_due'
  | 'over_capacity';

export interface StockAlert {
  id: string;
  kind: StockAlertKind;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  binId?: string;
  itemId?: string | null;
  itemName?: string | null;
  /** Direct navigation target (PRD §4.16 — one-click). */
  target: string;
}

export interface AlertInput extends DashboardInput {
  /** Phase 7 — cycle counts due (opt-in; empty = none due). */
  cycleCountsDue?: Array<{ id: string; label: string }>;
}

export interface DashboardViewModel {
  summary: SummaryStats;
  tasks: TaskItem[];
  alerts: StockAlert[];
  queues: QueueSection[];
  zoneUtilization: ZoneUtilization[];
  congestedZones: ZoneUtilization[];
  heatCells: HeatCell[];
  storageUtilization: { pct: number; label: string; color: string; currentQty: number; maxQty: number; remaining: number };
  activity: ActivityItem[];
  movementHistory: ActivityItem[];
  fastMoving: MovingItem[];
  slowMoving: MovingItem[];
  frequentlyPicked: MovingItem[];
  unusedStorage: Array<{ binId: string; binName: string; warehouseId?: string | null; zoneName?: string | null }>;
  efficiency: { score: number; label: string; openDocs: number; closedDocs: number; note: string };
  recommendations: Recommendation[];
  generatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receive: 'Received', transfer_out: 'Transfer Out', transfer_in: 'Transfer In',
  dispatch: 'Dispatched', consolidate: 'Consolidated', overflow: 'Overflow',
  replenish: 'Replenished', adjust: 'Adjusted', pick: 'Picked', other: 'Movement', reversal: 'Reversal',
};

function openTransferStatuses(): Set<string> {
  return new Set(['draft', 'requested', 'approved', 'picking', 'in_transit', 'received']);
}
function openDispatchStatuses(): Set<string> {
  return new Set(['draft', 'reserved', 'picking', 'packing', 'ready', 'loaded']);
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function buildDashboardViewModel(input: DashboardInput): DashboardViewModel {
  const bins = input.bins;
  const now = Date.now();
  const windowMs = (input.movingWindowDays ?? 14) * 24 * 60 * 60 * 1000;

  // ── 1. Summary ─────────────────────────────────────────────────────────────
  const qtyByBin = new Map<string, number>();
  // Per-(bin, item) quantity map — replenishment rules are per (bin, item),
  // so both rule currentQty and bulk-source availability need item-level
  // quantities, not bin totals (review finding).
  const qtyByBinItem = new Map<string, number>();
  for (const bi of input.binItems) {
    const q = Number(bi.quantity) || 0;
    if (q <= 0) continue;
    qtyByBin.set(bi.bin_id, (qtyByBin.get(bi.bin_id) ?? 0) + q);
    if (bi.item_id) qtyByBinItem.set(`${bi.bin_id}|${bi.item_id}`, (qtyByBinItem.get(`${bi.bin_id}|${bi.item_id}`) ?? 0) + q);
  }
  const capRows = bins.map(b => ({
    id: b.id,
    max_quantity: b.maxQuantity ?? null,      current_quantity: (qtyByBin.get(b.id) ?? Number(b.currentQty)) || 0,
  }));
  const cap = aggregateCapacity(capRows, qtyByBin);
  const distinctItems = new Set(input.binItems.map(bi => bi.item_id).filter((v): v is string => !!v));

  const openTransfers = input.transfers.filter(t => openTransferStatuses().has(t.status));
  const openDispatches = input.dispatches.filter(d => openDispatchStatuses().has(d.status));
  const queuedPicks = input.pickLists.filter(p => p.status === 'queued' || p.status === 'picking');

  // Replenishment needs (PRD §9.14 — Bulk → Picking trigger). Bulk sources
  // must carry the ACTUAL item each bulk bin holds (one source per bulk-bin
  // item) so computeReplenishmentNeeds' item matching fires; a bare bulk bin
  // with itemId:null can never match a rule (review finding).
  const bulkBinByName = new Map(bins.filter(b => b.storageRole === 'bulk_storage' && !b.blocked).map(b => [b.id, b]));
  const bulkBins: Array<{ binId: string; binName: string; storageRole: string; itemId: string | null; availableQty: number }> = [];
  for (const bi of input.binItems) {
    if (!bi.item_id) continue;
    const bulk = bulkBinByName.get(bi.bin_id);
    if (!bulk) continue;
    const q = Number(bi.quantity) || 0;
    if (q <= 0) continue;
    bulkBins.push({ binId: bi.bin_id, binName: bulk.name, storageRole: 'bulk_storage', itemId: bi.item_id, availableQty: q });
  }
  const replenishNeeds = computeReplenishmentNeeds({
    rules: input.replenishmentRules.map(r => ({
      ruleId: r.ruleId, binId: r.binId, binName: r.binName, itemId: r.itemId,
      itemName: r.itemName, minQty: r.minQty, maxQty: r.maxQty,
      // Rule currentQty = quantity of the RULE'S item in the bin, not the
      // bin total (a bin holding two items must not mask a real need).
      currentQty: r.itemId ? qtyByBinItem.get(`${r.binId}|${r.itemId}`) ?? 0 : r.currentQty,
      enabled: r.enabled,
    })),
    bulkBins,
  });

  const summary: SummaryStats = {
    warehouseCount: input.warehouses.length,
    binCount: bins.length,
    configuredBinCount: cap.configuredBinCount,
    totalUnits: cap.currentQty,
    distinctItems: distinctItems.size,
    occupancyPct: cap.pct,
    occupancyLabel: cap.label,
    occupancyColor: cap.color,
    openTransfers: openTransfers.length,
    openDispatches: openDispatches.length,
    queuedPickLists: queuedPicks.length,
    replenishmentNeeds: replenishNeeds.length,
  };

  // ── 2. Today's Tasks (PRD §2.10 — derived, auto-disappear) ────────────────
  const tasks: TaskItem[] = [];
  if (replenishNeeds.length > 0) {
    tasks.push({
      id: 'replenish', icon: 'replenish', count: replenishNeeds.length,
      title: `Refill ${replenishNeeds.length} picking bin${replenishNeeds.length !== 1 ? 's' : ''}`,
      detail: replenishNeeds[0].sources.length > 0
        ? `e.g. ${replenishNeeds[0].rule.binName} needs ${replenishNeeds[0].deficit} from bulk`
        : 'below minimum — bulk sources needed',
      severity: replenishNeeds.length >= 3 ? 'warning' : 'info',
    });
  }
  const needsApproval = input.transfers.filter(t => t.status === 'requested');
  if (needsApproval.length > 0) {
    tasks.push({
      id: 'approve-transfers', icon: 'approve', count: needsApproval.length,
      title: `Approve ${needsApproval.length} internal transfer${needsApproval.length !== 1 ? 's' : ''}`,
      detail: needsApproval[0].itemName ? `top: ${needsApproval[0].itemName}` : 'awaiting approval',
      severity: 'info',
    });
  }
  const draftsToReserve = input.dispatches.filter(d => d.status === 'draft');
  if (draftsToReserve.length > 0) {
    tasks.push({
      id: 'dispatch-reserve', icon: 'dispatch', count: draftsToReserve.length,
      title: `Reserve stock for ${draftsToReserve.length} dispatch${draftsToReserve.length !== 1 ? 'es' : ''}`,
      detail: draftsToReserve[0].sales_order_ref ? `top: ${draftsToReserve[0].sales_order_ref}` : 'pending sales orders in queue',
      severity: draftsToReserve.length >= 3 ? 'warning' : 'info',
    });
  }
  const queuedOnly = input.pickLists.filter(p => p.status === 'queued');
  if (queuedOnly.length > 0) {
    tasks.push({
      id: 'start-picks', icon: 'pick', count: queuedOnly.length,
      title: `Start ${queuedOnly.length} queued pick list${queuedOnly.length !== 1 ? 's' : ''}`,
      detail: queuedOnly[0].itemName ? `top: ${queuedOnly[0].itemName}` : 'outbound orders ready to pick',
      severity: 'info',
    });
  }
  const qualityBins = bins.filter(b => b.qualityHold);
  if (qualityBins.length > 0) {
    tasks.push({
      id: 'quality-hold', icon: 'quality', count: qualityBins.length,
      title: `Review ${qualityBins.length} quality-hold bin${qualityBins.length !== 1 ? 's' : ''}`,
      detail: 'quarantine / inspection required',
      severity: 'warning',
    });
  }

  // ── 3. Queues (Operations Section) ─────────────────────────────────────────
  const queues: QueueSection[] = [];

  queues.push({
    id: 'replenishment',
    label: 'Pending Replenishment',
    items: replenishNeeds.slice(0, 5).map(n => ({
      id: n.rule.ruleId,
      title: n.rule.binName,
      subtitle: n.rule.itemName ? `${n.rule.itemName} — ${n.rule.currentQty}/${n.rule.minQty}` : `${n.rule.currentQty}/${n.rule.minQty} units`,
      meta: `need ${n.deficit}`,
      badge: n.sources.length > 0 ? `${n.sources.length} source${n.sources.length !== 1 ? 's' : ''}` : 'no bulk source',
      badgeClass: n.sources.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200',
      action: n.sources.length > 0 ? 'Refill' : 'Source',
    })),
    emptyText: 'All picking bins are above minimum.',
  });

  queues.push({
    id: 'transfers',
    label: 'Pending Transfers',
    items: openTransfers.slice(0, 5).map(t => ({
      id: t.id,
      title: t.transfer_no ?? 'Transfer',
      subtitle: `${t.itemName ?? 'Item'} · ${t.sourceBinName ?? '—'} → ${t.destinationBinName ?? '—'}`,
      meta: `qty ${t.quantity ?? 0}`,
      badge: TRANSFER_STATUS_META[t.status as keyof typeof TRANSFER_STATUS_META]?.label ?? t.status,
      badgeClass: TRANSFER_STATUS_META[t.status as keyof typeof TRANSFER_STATUS_META]?.badge ?? '',
      action: TRANSFER_PRIORITY_META[t.priority]?.label ?? t.priority,
    })),
    emptyText: 'No open internal transfers.',
  });

  queues.push({
    id: 'dispatch',
    label: 'Dispatch Queue',
    items: openDispatches.slice(0, 5).map(d => ({
      id: d.id,
      title: d.dispatch_no ?? 'Dispatch',
      subtitle: `${d.itemName ?? 'Item'}${d.sales_order_ref ? ` · ${d.sales_order_ref}` : ''} · from ${d.sourceBinName ?? '—'}`,
      meta: `qty ${d.quantity ?? 0}`,
      badge: DISPATCH_STATUS_META[d.status as keyof typeof DISPATCH_STATUS_META]?.label ?? d.status,
      badgeClass: DISPATCH_STATUS_META[d.status as keyof typeof DISPATCH_STATUS_META]?.badge ?? '',
      action: DISPATCH_QUEUE_ORDER.includes(d.status as never) ? 'in queue' : undefined,
    })),
    emptyText: 'No open dispatches.',
  });

  queues.push({
    id: 'picking',
    label: 'Picking Queue',
    items: queuedPicks.slice(0, 5).map(p => ({
      id: p.id,
      title: p.pick_no ?? 'Pick list',
      subtitle: `${p.itemName ?? 'Item'}${p.source_ref ? ` · ${p.source_ref}` : ''}`,
      meta: p.status,
      badge: PICK_STATUS_META[p.status as keyof typeof PICK_STATUS_META]?.label ?? p.status,
      badgeClass: PICK_STATUS_META[p.status as keyof typeof PICK_STATUS_META]?.badge ?? '',
      action: 'pick',
    })),
    emptyText: 'No queued pick lists.',
  });

  queues.push({
    id: 'quality',
    label: 'Quality Hold Queue',
    items: qualityBins.slice(0, 5).map(b => ({
      id: b.id,
      title: b.name,
      subtitle: b.zoneName ?? '—',
      meta: `${qtyByBin.get(b.id) ?? 0} units`,
      badge: 'Hold',
      badgeClass: 'bg-rose-50 text-rose-600 border-rose-200',
      action: 'review',
    })),
    emptyText: 'No quality-hold bins.',
  });

  queues.push({
    id: 'cycle-count',
    label: 'Cycle Count Queue',
    items: (input.cycleCounts ?? []).slice(0, 5).map(c => ({
      id: c.id,
      title: c.label,
      subtitle: `${c.countedCount}/${c.itemCount} lines counted`,
      meta: c.varianceCount > 0 ? `${c.varianceCount} variance` : 'no variance',
      badge: CYCLE_STATUS_META[c.status as keyof typeof CYCLE_STATUS_META]?.label ?? c.status,
      badgeClass: CYCLE_STATUS_META[c.status as keyof typeof CYCLE_STATUS_META]?.badge ?? '',
      action: c.status === 'scheduled' ? 'Start' : c.status === 'in_progress' ? 'Count' : undefined,
    })),
    emptyText: 'No cycle counts scheduled.',
  });

  // ── 4. Warehouse Section: utilization + heat map + activity ───────────────
  const byZone = new Map<string, DashboardBin[]>();
  for (const b of bins) {
    const key = b.zoneName ?? 'Unzoned';
    const list = byZone.get(key) ?? [];
    list.push(b);
    byZone.set(key, list);
  }
  const zoneUtilization: ZoneUtilization[] = [...byZone.entries()].map(([zoneName, zbins]) => {
    const zcap = aggregateCapacity(
      zbins.map(b => ({ id: b.id, max_quantity: b.maxQuantity ?? null, current_quantity: (qtyByBin.get(b.id) ?? Number(b.currentQty)) || 0 })),
      qtyByBin
    );
    return {
      zoneName,
      storageRole: zbins[0]?.storageRole ?? null,
      binCount: zbins.length,
      configuredBinCount: zcap.configuredBinCount,
      currentQty: zcap.currentQty,
      maxQty: zcap.maxQty,
      pct: zcap.pct,
      label: zcap.label,
      color: zcap.color,
      congested: zcap.pct > 90,
    };
  }).sort((a, b) => b.pct - a.pct);
  const congestedZones = zoneUtilization.filter(z => z.congested);

  // Heat map — one cell per bin, occupancy-coloured (PRD §6.9 palette).
  const heatCells: HeatCell[] = bins.slice(0, 200).map(b => {      const occ = computeBinOccupancy((qtyByBin.get(b.id) ?? Number(b.currentQty)) || 0, b.maxQuantity);
    return {
      binId: b.id,
      binName: b.name,
      pct: occ.pct,
      level: occ.level,
      color: occ.color,
      label: occ.label,
    };
  });

  // ── 5. Activity (recent movements) ─────────────────────────────────────────
  const binNameById = new Map(bins.map(b => [b.id, b.name]));
  const movementHistory: ActivityItem[] = [...input.movements]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .map(m => ({
      id: m.id,
      type: m.movement_type,
      typeLabel: MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type,
      sign: (m.quantity ?? 0) < 0 ? '-' : '+',
      quantity: Math.abs(Number(m.quantity) || 0),
      itemName: m.item_id ? input.itemNames?.get(m.item_id) ?? null : null,
      binName: binNameById.get(m.source_bin_id ?? '') ?? binNameById.get(m.destination_bin_id ?? '') ?? null,
      remarks: m.remarks ?? null,
      at: m.created_at ?? null,
    }));
  const activity = movementHistory.slice(0, 8);

  // ── 6. Insights: fast / slow / frequent movers, unused storage ─────────────
  const windowStart = now - windowMs;
  const byItem = new Map<string, { count: number; netQty: number; pickedQty: number }>();
  for (const m of input.movements) {
    if (!m.item_id) continue;
    const at = m.created_at ? new Date(m.created_at).getTime() : NaN;
    if (Number.isNaN(at) || at < windowStart) continue;
    const e = byItem.get(m.item_id) ?? { count: 0, netQty: 0, pickedQty: 0 };
    e.count++;
    e.netQty += Number(m.quantity) || 0;
    if (m.movement_type === 'pick') e.pickedQty += Math.abs(Number(m.quantity) || 0);
    byItem.set(m.item_id, e);
  }
  const itemName = (id: string | null) => (id ? input.itemNames?.get(id) ?? null : null);
  const fastMoving: MovingItem[] = [...byItem.entries()]
    .map(([itemId, e]) => ({ itemId, itemName: itemName(itemId), movementCount: e.count, netQty: e.netQty }))
    .sort((a, b) => b.movementCount - a.movementCount)
    .slice(0, 5);

  // Slow movers: items still in stock with ZERO movement events in the window.
  const stockedItemIds = new Set(input.binItems.map(bi => bi.item_id).filter((v): v is string => !!v));
  const slowMoving: MovingItem[] = [...stockedItemIds]
    .filter(id => !byItem.has(id))
    .map(itemId => ({ itemId, itemName: itemName(itemId), movementCount: 0, netQty: 0 }))
    .slice(0, 5);

  const frequentlyPicked: MovingItem[] = [...byItem.entries()]
    .filter(([, e]) => e.pickedQty > 0)
    .map(([itemId, e]) => ({ itemId, itemName: itemName(itemId), movementCount: e.count, netQty: e.pickedQty }))
    .sort((a, b) => b.netQty - a.netQty)
    .slice(0, 5);

  const unusedStorage = bins
    .filter(b => (b.maxQuantity ?? 0) > 0 && ((qtyByBin.get(b.id) ?? 0) === 0))
    .map(b => ({ binId: b.id, binName: b.name, warehouseId: b.warehouseId ?? null, zoneName: b.zoneName ?? null }))
    .slice(0, 8);

  // ── 7. Efficiency KPI ──────────────────────────────────────────────────────
  const closedDocs = input.transfers.filter(t => t.status === 'completed').length
    + input.dispatches.filter(d => d.status === 'completed').length
    + input.pickLists.filter(p => p.status === 'completed').length;
  const openDocs = openTransfers.length + openDispatches.length + queuedPicks.length;
  const totalDocs = closedDocs + openDocs;
  const completionRate = totalDocs > 0 ? Math.round((closedDocs / totalDocs) * 100) : 0;
  const utilScore = cap.configuredBinCount > 0 ? Math.min(100, Math.round((cap.pct / 100) * 100)) : 0;
  // Balanced warehouses (neither empty nor saturated) score better.
  const balance = 100 - Math.abs(50 - cap.pct) * 1.5;
  const efficiencyScore = Math.round((completionRate * 0.6 + Math.max(0, Math.min(100, balance)) * 0.4));
  const efficiency = {
    score: efficiencyScore,
    label: efficiencyScore >= 75 ? 'Healthy' : efficiencyScore >= 45 ? 'Manageable' : 'Attention',
    openDocs,
    closedDocs,
    note: `${completionRate}% documents completed · ${cap.pct}% storage used`,
  };

  // ── 8. Rule-based AI Recommendations (PRD §2.5 AI Recommendations) ─────────
  const recommendations: Recommendation[] = [];
  if (replenishNeeds.length > 0) {
    recommendations.push({
      id: 'rec-replenish', kind: 'action',
      title: `Replenish ${replenishNeeds.length} picking bin${replenishNeeds.length !== 1 ? 's' : ''}`,
      detail: `${replenishNeeds.filter(n => n.sources.length > 0).length} have bulk sources ready — refill to clear the queue.`,
    });
  }
  const overCapBins = bins.filter(b => (b.maxQuantity ?? 0) > 0 && (qtyByBin.get(b.id) ?? 0) > (b.maxQuantity ?? 0));
  if (overCapBins.length > 0) {
    recommendations.push({
      id: 'rec-overflow', kind: 'alert',
      title: `${overCapBins.length} bin${overCapBins.length !== 1 ? 's' : ''} over capacity`,
      detail: `${overCapBins.slice(0, 3).map(b => b.name).join(', ')}${overCapBins.length > 3 ? '…' : ''} — move stock to overflow or consolidate.`,
    });
  }
  // Consolidation: group ONLY the bins that actually hold each item, so
  // suggestConsolidation never proposes merging bins that don't contain it.
  const itemToBins = new Map<string, Array<{ binId: string; binName: string; currentQty: number; freeCapacity: number }>>();
  for (const bi of input.binItems) {
    if (!bi.item_id || (Number(bi.quantity) || 0) <= 0) continue;
    const bin = bins.find(b => b.id === bi.bin_id);
    const list = itemToBins.get(bi.item_id) ?? [];
    list.push({
      binId: bi.bin_id,
      binName: bin?.name ?? bi.bin_id,
      currentQty: Number(bi.quantity) || 0,
      freeCapacity: bin?.freeCapacity ?? 0,
    });
    itemToBins.set(bi.item_id, list);
  }
  const consolidationGroups = suggestConsolidation(
    [...itemToBins.entries()].slice(0, 20).map(([itemId, bs]) => ({ itemId, bins: bs }))
  );
  if (consolidationGroups.length > 0) {
    recommendations.push({
      id: 'rec-consolidate', kind: 'action',
      title: `Consolidate ${consolidationGroups.length} item${consolidationGroups.length !== 1 ? 's' : ''}`,
      detail: `Merging would free ${consolidationGroups[0].consolidatableQty}+ units of bin space.`,
    });
  }
  if (congestedZones.length > 0) {
    recommendations.push({
      id: 'rec-congestion', kind: 'alert',
      title: `${congestedZones.length} congested zone${congestedZones.length !== 1 ? 's' : ''} (>90%)`,
      detail: congestedZones.slice(0, 3).map(z => `${z.zoneName} ${z.pct}%`).join(', '),
    });
  }
  if (unusedStorage.length >= 3) {
    recommendations.push({
      id: 'rec-unused', kind: 'info',
      title: `${unusedStorage.length} configured bins unused`,
      detail: 'Empty capacity exists — consider rebalancing inbound put-away to these bins.',
    });
  }
  if (openDocs > 0) {
    recommendations.push({
      id: 'rec-open', kind: 'info',
      title: `${openDocs} open operation${openDocs !== 1 ? 's' : ''} in flight`,
      detail: `${openTransfers.length} transfers · ${openDispatches.length} dispatches · ${queuedPicks.length} picks — tackle Today's Tasks to clear.`,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec-clear', kind: 'info',
      title: 'All clear',
      detail: 'No rule-based alerts right now — operations are healthy.',
    });
  }

  return {
    summary,
    tasks,
    alerts: computeStockAlerts(input),
    queues,
    zoneUtilization,
    congestedZones,
    heatCells,
    storageUtilization: { pct: cap.pct, label: cap.label, color: cap.color, currentQty: cap.currentQty, maxQty: cap.maxQty, remaining: cap.remaining },
    activity,
    movementHistory,
    fastMoving,
    slowMoving,
    frequentlyPicked,
    unusedStorage,
    efficiency,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Stock Alerts (PRD §4.16 — one-click navigation) ─────────────────────────

export function computeStockAlerts(input: AlertInput): StockAlert[] {
  const alerts: StockAlert[] = [];
  const qtyByBin = new Map<string, number>();
  for (const bi of input.binItems) {
    const q = Number(bi.quantity) || 0;
    if (q > 0) qtyByBin.set(bi.bin_id, (qtyByBin.get(bi.bin_id) ?? 0) + q);
  }

  // Low picking quantity — picking bins below their replenishment minimum.
  for (const r of input.replenishmentRules) {
    if (!r.enabled) continue;
    const qty = qtyByBin.get(r.binId) ?? 0;
    if (qty < r.minQty) {
      alerts.push({
        id: `low-${r.ruleId}`, kind: 'low_picking', severity: qty <= 0 ? 'critical' : 'warning',
        title: `Low picking stock: ${r.binName}`,
        detail: `${qty} of minimum ${r.minQty} — refill from bulk.`,
        binId: r.binId, itemId: r.itemId, itemName: r.itemName,
        target: '/warehouse/operations',
      });
    }
  }

  // Bin full / over capacity / blocked.
  for (const b of input.bins) {
    const qty = (qtyByBin.get(b.id) ?? Number(b.currentQty)) || 0;
    const max = Number(b.maxQuantity) || 0;
    if (b.blocked) {
      alerts.push({
        id: `blocked-${b.id}`, kind: 'bin_blocked', severity: 'warning',
        title: `Bin blocked: ${b.name}`,
        detail: 'Movement into this bin is disabled until unblocked.',
        binId: b.id, target: '/warehouse/viewer',
      });
    } else if (max > 0 && qty > max) {
      alerts.push({
        id: `over-${b.id}`, kind: 'over_capacity', severity: 'critical',
        title: `Over capacity: ${b.name}`,
        detail: `${qty} units in a ${max}-unit bin — move stock to overflow.`,
        binId: b.id, target: '/warehouse/viewer',
      });
    } else if (max > 0 && qty >= max) {
      alerts.push({
        id: `full-${b.id}`, kind: 'bin_full', severity: 'warning',
        title: `Bin full: ${b.name}`,
        detail: `${qty}/${max} units — consolidation suggested.`,
        binId: b.id, target: '/warehouse/viewer',
      });
    }
  }

  // No movement — stocked bins untouched within the moving window (dead stock).
  const windowStart = Date.now() - ((input.movingWindowDays ?? 14) * 24 * 60 * 60 * 1000);
  const touchedBins = new Set<string>();
  for (const m of input.movements) {
    const at = m.created_at ? new Date(m.created_at).getTime() : NaN;
    if (Number.isNaN(at) || at < windowStart) continue;
    if (m.source_bin_id) touchedBins.add(m.source_bin_id);
    if (m.destination_bin_id) touchedBins.add(m.destination_bin_id);
  }
  for (const b of input.bins) {
    const qty = qtyByBin.get(b.id) ?? 0;
    if (qty > 0 && !touchedBins.has(b.id)) {
      alerts.push({
        id: `dead-${b.id}`, kind: 'no_movement', severity: 'info',
        title: `No movement: ${b.name}`,
        detail: `${qty} units untouched in the last ${input.movingWindowDays ?? 14} days.`,
        binId: b.id, target: '/warehouse/viewer',
      });
    }
  }

  // Quality hold bins.
  for (const b of input.bins) {
    if (b.qualityHold) {
      alerts.push({
        id: `qh-${b.id}`, kind: 'quality_hold', severity: 'warning',
        title: `Quality hold: ${b.name}`,
        detail: `${qtyByBin.get(b.id) ?? 0} units awaiting inspection.`,
        binId: b.id, target: '/warehouse/viewer',
      });
    }
  }

  // Cycle counts due (Phase 7).
  for (const c of input.cycleCountsDue ?? []) {
    alerts.push({
      id: `cc-${c.id}`, kind: 'cycle_due', severity: 'warning',
      title: `Cycle count due: ${c.label}`,
      detail: 'A scheduled count is pending — freeze the location and count.',
      target: '/warehouse/operations',
    });
  }

  return alerts;
}

// ─── Convenience re-export for consumers ─────────────────────────────────────

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type;
}
