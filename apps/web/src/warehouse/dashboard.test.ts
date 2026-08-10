// src/warehouse/dashboard.test.ts
// Unit tests for the Phase 5 Dashboard Engine (pure, TAD §2.15).

import { describe, it, expect } from 'vitest';
import { buildDashboardViewModel, computeStockAlerts, movementTypeLabel } from './dashboard';
import type { AlertInput, DashboardInput } from './dashboard';

function baseInput(overrides: Partial<AlertInput> = {}): DashboardInput {
  return {
    warehouses: [{ id: 'W1', name: 'Main' }],
    bins: [
      { id: 'b1', name: 'PK-01', warehouseId: 'W1', zoneName: 'Picking', storageRole: 'picking', maxQuantity: 100, currentQty: 50, freeCapacity: 50 },
      { id: 'b2', name: 'PK-02', warehouseId: 'W1', zoneName: 'Picking', storageRole: 'picking', maxQuantity: 100, currentQty: 10, freeCapacity: 90 },
      { id: 'b3', name: 'BLK-01', warehouseId: 'W1', zoneName: 'Bulk', storageRole: 'bulk_storage', maxQuantity: 500, currentQty: 400, freeCapacity: 100 },
      { id: 'b4', name: 'QH-01', warehouseId: 'W1', zoneName: 'Quality', storageRole: 'quality_hold', maxQuantity: 50, currentQty: 20, freeCapacity: 30, qualityHold: true },
      { id: 'b5', name: 'PK-03', warehouseId: 'W1', zoneName: 'Picking', storageRole: 'picking', maxQuantity: 100, currentQty: 0, freeCapacity: 100 },
    ],
    binItems: [
      { bin_id: 'b1', item_id: 'it-a', quantity: 30 },
      { bin_id: 'b1', item_id: 'it-b', quantity: 20 },
      { bin_id: 'b2', item_id: 'it-a', quantity: 10 },
      { bin_id: 'b3', item_id: 'it-c', quantity: 400 },
      { bin_id: 'b4', item_id: 'it-d', quantity: 20 },
    ],
    movements: [
      { id: 'm1', movement_type: 'receive', reference_type: 'receiving', item_id: 'it-a', quantity: 30, created_at: new Date(Date.now() - 60_000).toISOString() },
      { id: 'm2', movement_type: 'pick', reference_type: 'picking', item_id: 'it-a', quantity: -10, created_at: new Date(Date.now() - 120_000).toISOString() },
      { id: 'm3', movement_type: 'pick', reference_type: 'picking', item_id: 'it-b', quantity: -5, created_at: new Date(Date.now() - 180_000).toISOString() },
    ],
    transfers: [
      { id: 't1', transfer_no: 'TRF-1', status: 'requested', priority: 'high', itemName: 'it-a', quantity: 10, created_at: new Date().toISOString() },
      { id: 't2', transfer_no: 'TRF-2', status: 'completed', priority: 'normal', itemName: 'it-b', quantity: 5, created_at: new Date().toISOString() },
    ],
    dispatches: [
      { id: 'd1', dispatch_no: 'DSP-1', status: 'draft', priority: 'high', itemName: 'it-a', quantity: 4, created_at: new Date().toISOString() },
    ],
    pickLists: [
      { id: 'p1', pick_no: 'PK-1', status: 'queued', priority: 'normal', itemName: 'it-a', created_at: new Date().toISOString() },
    ],
    replenishmentRules: [
      { ruleId: 'r1', binId: 'b2', binName: 'PK-02', itemId: 'it-a', itemName: 'it-a', minQty: 40, maxQty: 80, currentQty: 10, enabled: true },
    ],
    itemNames: new Map([['it-a', 'Widget A'], ['it-b', 'Widget B'], ['it-c', 'Bolt C'], ['it-d', 'Nut D']]),
    ...overrides,
  };
}

describe('buildDashboardViewModel — summary', () => {
  const vm = buildDashboardViewModel(baseInput());

  it('counts warehouses, bins and distinct items', () => {
    expect(vm.summary.warehouseCount).toBe(1);
    expect(vm.summary.binCount).toBe(5);
    expect(vm.summary.distinctItems).toBe(4);
  });

  it('computes occupancy from bin capacities and live quantities', () => {
    // current = 30+20 (b1) + 10 (b2) + 400 (b3) + 20 (b4) = 480; max = 100+100+500+50+100 = 850
    expect(vm.summary.totalUnits).toBe(480);
    expect(vm.summary.occupancyPct).toBeCloseTo(56.5, 1);
  });

  it('counts open operations and replenishment needs', () => {
    expect(vm.summary.openTransfers).toBe(1); // TRF-1 requested
    expect(vm.summary.openDispatches).toBe(1); // DSP-1 draft
    expect(vm.summary.queuedPickLists).toBe(1);
    expect(vm.summary.replenishmentNeeds).toBe(1); // PK-02 below min 40
  });
});

describe('buildDashboardViewModel — today tasks (PRD §2.10)', () => {
  it('derives a refill task from replenishment needs', () => {
    const vm = buildDashboardViewModel(baseInput());
    const task = vm.tasks.find(t => t.icon === 'replenish');
    expect(task).toBeDefined();
    expect(task?.count).toBe(1);
  });

  it('derives approve + dispatch-reserve + start-picks tasks', () => {
    const vm = buildDashboardViewModel(baseInput());
    expect(vm.tasks.some(t => t.icon === 'approve' && t.count === 1)).toBe(true);
    expect(vm.tasks.some(t => t.icon === 'dispatch' && t.count === 1)).toBe(true);
    expect(vm.tasks.some(t => t.icon === 'pick' && t.count === 1)).toBe(true);
  });

  it('derives a quality-hold review task', () => {
    const vm = buildDashboardViewModel(baseInput());
    expect(vm.tasks.some(t => t.icon === 'quality' && t.count === 1)).toBe(true);
  });

  it('produces no tasks when everything is clear', () => {
    const vm = buildDashboardViewModel(baseInput({
      bins: baseInput().bins.filter(b => !b.qualityHold),
      transfers: [{ id: 't2', transfer_no: 'TRF-2', status: 'completed', priority: 'normal', itemName: 'it-b', quantity: 5, created_at: new Date().toISOString() }],
      dispatches: [],
      pickLists: [],
      replenishmentRules: [],
      movements: [],
    }));
    expect(vm.tasks.length).toBe(0);
  });
});

describe('buildDashboardViewModel — queues', () => {
  const vm = buildDashboardViewModel(baseInput());

  it('builds the replenishment queue with deficit + sources', () => {
    const q = vm.queues.find(x => x.id === 'replenishment');
    expect(q).toBeDefined();
    expect(q?.items[0].title).toBe('PK-02');
  });

  it('shows scheduled/in-progress cycle counts in the cycle-count queue', () => {
    const vm2 = buildDashboardViewModel(baseInput({
      cycleCounts: [
        { id: 'cc1', label: 'CC-1 · Warehouse abc', status: 'scheduled', itemCount: 12, countedCount: 0, varianceCount: 0, scheduledFor: new Date().toISOString() },
        { id: 'cc2', label: 'CC-2 · Zone Picking', status: 'in_progress', itemCount: 8, countedCount: 5, varianceCount: 2, scheduledFor: null },
        { id: 'cc3', label: 'CC-3 · Bin PK-01', status: 'completed', itemCount: 3, countedCount: 3, varianceCount: 0, scheduledFor: null },
      ],
    }));
    const q = vm2.queues.find(x => x.id === 'cycle-count');
    expect(q).toBeDefined();
    expect(q?.items.length).toBe(3);
    expect(q?.items[0].title).toBe('CC-1 · Warehouse abc');
    expect(q?.items[0].badge).toBe('Scheduled');
    expect(q?.items[0].action).toBe('Start');
    expect(q?.items[1].badge).toBe('In Progress');
    expect(q?.items[1].action).toBe('Count');
    expect(q?.items[1].meta).toContain('2 variance');
    expect(q?.items[2].action).toBeUndefined();
  });

  it('emits cycle-due alerts from cycleCountsDue input', () => {
    const vm2 = buildDashboardViewModel(baseInput({
      cycleCountsDue: [{ id: 'cc9', label: 'CC-9 · Zone Bulk' }],
    }));
    const alert = vm2.alerts.find(a => a.kind === 'cycle_due');
    expect(alert).toBeDefined();
    expect(alert?.title).toContain('CC-9');
    expect(alert?.severity).toBe('warning');
  });

  it('matches bulk sources to the rule item (regression: itemId was null)', () => {
    // b3 (bulk) holds it-c; rule r1 targets it-a in b2. Give bulk a source
    // for it-a too and expect the queue badge to show a real source.
    const vm2 = buildDashboardViewModel(baseInput({
      binItems: [
        ...baseInput().binItems,
        { bin_id: 'b3', item_id: 'it-a', quantity: 120 },
      ],
    }));
    const q = vm2.queues.find(x => x.id === 'replenishment');
    expect(q?.items[0].badgeClass).not.toContain('red-');
    expect(q?.items[0].badge).toContain('source');
    // The engine's replenish task should now show bulk sources available.
    const task = vm2.tasks.find(t => t.icon === 'replenish');
    expect(task?.detail).not.toContain('bulk sources needed');
  });

  it('computes rule currentQty from the rule item only, not bin total', () => {
    // b2 holds it-a (10) AND it-b (20) = 30 bin-total. The rule for it-a has
    // min 40 → still a deficit of 30, proving per-item qty (10) is used.
    const vm2 = buildDashboardViewModel(baseInput({
      binItems: [...baseInput().binItems, { bin_id: 'b2', item_id: 'it-b', quantity: 20 }],
    }));
    const q = vm2.queues.find(x => x.id === 'replenishment');
    expect(q?.items[0].meta).toContain('30'); // deficit = 40 - 10 = 30
  });

  it('builds transfer, dispatch, picking and quality queues', () => {
    const ids = vm.queues.map(q => q.id);
    expect(ids).toContain('transfers');
    expect(ids).toContain('dispatch');
    expect(ids).toContain('picking');
    expect(ids).toContain('quality');
    expect(ids).toContain('cycle-count');
    expect(vm.queues.find(q => q.id === 'transfers')?.items.length).toBe(1);
    expect(vm.queues.find(q => q.id === 'dispatch')?.items.length).toBe(1);
    expect(vm.queues.find(q => q.id === 'quality')?.items.length).toBe(1);
  });

  it('shows empty text for cycle-count (Phase 7)', () => {
    const q = vm.queues.find(x => x.id === 'cycle-count');
    expect(q?.items.length).toBe(0);
    expect(q?.emptyText).toContain('No cycle counts');
  });
});

describe('buildDashboardViewModel — warehouse section', () => {
  const vm = buildDashboardViewModel(baseInput());

  it('computes zone utilization sorted by pct and flags congested zones', () => {
    const zones = vm.zoneUtilization;
    expect(zones.length).toBe(3); // Picking, Bulk, Quality
    expect(zones[0].pct).toBeGreaterThanOrEqual(zones[1].pct);
    // Bulk = 400/500 = 80% (not congested); picking = 60/200 = 30%; quality = 40%
    expect(zones.some(z => z.congested)).toBe(false);
  });

  it('flags a zone congested above 90%', () => {
    const vm2 = buildDashboardViewModel(baseInput({
      bins: baseInput().bins.map(b => b.id === 'b3' ? { ...b, currentQty: 490, maxQuantity: 500 } : b),
      binItems: baseInput().binItems.map(bi => bi.bin_id === 'b3' ? { ...bi, quantity: 490 } : bi),
    }));
    expect(vm2.congestedZones.some(z => z.zoneName === 'Bulk')).toBe(true);
  });

  it('emits one heat cell per bin with occupancy colour', () => {
    expect(vm.heatCells.length).toBe(5);
    expect(vm.heatCells[0]).toHaveProperty('color');
    expect(vm.heatCells[0]).toHaveProperty('level');
  });

  it('reports storage utilization aggregate', () => {
    expect(vm.storageUtilization.currentQty).toBe(480);
    expect(vm.storageUtilization.maxQty).toBe(850);
  });

  it('lists recent activity newest first', () => {
    expect(vm.activity.length).toBeGreaterThan(0);
    expect(vm.activity[0].id).toBe('m1'); // newest
    expect(vm.activity[0].itemName).toBe('Widget A');
  });
});

describe('buildDashboardViewModel — insights', () => {
  const vm = buildDashboardViewModel(baseInput());

  it('ranks fast movers by movement count within the window', () => {
    expect(vm.fastMoving[0].itemId).toBe('it-a'); // 2 movements
    expect(vm.fastMoving[0].itemName).toBe('Widget A');
  });

  it('excludes old movements outside the window', () => {
    const old = baseInput({
      movements: [{ id: 'm-old', movement_type: 'receive', reference_type: 'receiving', item_id: 'it-c', quantity: 100, created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString() }],
    });
    const vm2 = buildDashboardViewModel(old);
    expect(vm2.fastMoving.some(f => f.itemId === 'it-c')).toBe(false);
  });

  it('finds slow movers among stocked items with zero window movements', () => {
    expect(vm.slowMoving.some(s => s.itemId === 'it-c')).toBe(true); // in stock, no movements
    expect(vm.slowMoving.some(s => s.itemId === 'it-a')).toBe(false); // moved recently
  });

  it('ranks frequently picked by picked quantity', () => {
    // it-a picked 10, it-b picked 5
    expect(vm.frequentlyPicked[0].itemId).toBe('it-a');
  });

  it('finds unused configured bins', () => {
    expect(vm.unusedStorage.some(u => u.binName === 'PK-03')).toBe(true); // b5 empty
  });
});

describe('computeStockAlerts (PRD §4.16)', () => {
  const base = () => baseInput();

  it('flags low picking stock below minimum', () => {
    // r1: PK-02 (b2) min 40, holds 10 → low
    const alerts = computeStockAlerts(base());
    expect(alerts.some(a => a.kind === 'low_picking' && a.binId === 'b2')).toBe(true);
    expect(alerts.find(a => a.kind === 'low_picking')?.severity).toBe('warning');
  });

  it('flags empty picking stock as critical', () => {
    const input = base();
    const alerts = computeStockAlerts({
      ...input,
      replenishmentRules: [{ ruleId: 'r9', binId: 'b2', binName: 'PK-02', itemId: 'it-a', minQty: 40, maxQty: 80, currentQty: 0, enabled: true }],
      binItems: input.binItems.filter(bi => bi.bin_id !== 'b2'),
    });
    const a = alerts.find(x => x.kind === 'low_picking');
    expect(a?.severity).toBe('critical');
  });

  it('flags full and over-capacity bins', () => {
    const alerts = computeStockAlerts(base());
    // b3: 400/500 → not full; add a full bin via overrides.
    const input = base();
    const over = computeStockAlerts({
      ...input,
      bins: input.bins.map(b => b.id === 'b3' ? { ...b, maxQuantity: 100, currentQty: 400 } : b),
      binItems: input.binItems.map(bi => bi.bin_id === 'b3' ? { ...bi, quantity: 400 } : bi),
    });
    expect(over.some(a => a.kind === 'over_capacity')).toBe(true);
    // Blocked bin
    const blocked = computeStockAlerts({
      ...input,
      bins: input.bins.map(b => b.id === 'b5' ? { ...b, blocked: true } : b),
    });
    expect(blocked.some(a => a.kind === 'bin_blocked' && a.binId === 'b5')).toBe(true);
  });

  it('flags no-movement (dead stock) bins', () => {
    const alerts = computeStockAlerts(base());
    // b3 holds 400, zero movements in base() → dead stock
    expect(alerts.some(a => a.kind === 'no_movement' && a.binId === 'b3')).toBe(true);
  });

  it('flags quality-hold bins and cycle-counts-due', () => {
    const alerts = computeStockAlerts({
      ...base(),
      cycleCountsDue: [{ id: 'cc1', label: 'Zone A — Bin PK-01' }],
    });
    expect(alerts.some(a => a.kind === 'quality_hold')).toBe(true);
    expect(alerts.some(a => a.kind === 'cycle_due' && a.id === 'cc-cc1')).toBe(true);
  });

  it('every alert carries a one-click navigation target (PRD §4.16)', () => {
    for (const a of computeStockAlerts(base())) {
      expect(a.target.startsWith('/warehouse/')).toBe(true);
    }
  });
});

describe('buildDashboardViewModel — efficiency + recommendations', () => {
  const vm = buildDashboardViewModel(baseInput());

  it('computes an efficiency score from completion + balance', () => {
    expect(vm.efficiency.score).toBeGreaterThanOrEqual(0);
    expect(vm.efficiency.score).toBeLessThanOrEqual(100);
    expect(vm.efficiency.openDocs).toBe(3); // 1 transfer + 1 dispatch + 1 pick
    expect(vm.efficiency.closedDocs).toBe(1); // completed transfer
  });

  it('produces rule-based recommendations', () => {
    const kinds = vm.recommendations.map(r => r.kind);
    expect(kinds).toContain('action'); // replenish
    expect(kinds).toContain('info'); // open docs
  });

  it('reports all-clear when healthy', () => {
    // Healthy scenario: every item in exactly one bin (no consolidation
    // candidates), no quality holds, no open docs, rules above minimum.
    const vm2 = buildDashboardViewModel(baseInput({
      bins: [
        { id: 'b1', name: 'PK-01', warehouseId: 'W1', zoneName: 'Picking', storageRole: 'picking', maxQuantity: 100, currentQty: 40, freeCapacity: 60 },
        { id: 'b3', name: 'BLK-01', warehouseId: 'W1', zoneName: 'Bulk', storageRole: 'bulk_storage', maxQuantity: 500, currentQty: 400, freeCapacity: 100 },
        { id: 'b5', name: 'PK-03', warehouseId: 'W1', zoneName: 'Picking', storageRole: 'picking', maxQuantity: 100, currentQty: 0, freeCapacity: 100 },
      ],
      binItems: [
        { bin_id: 'b1', item_id: 'it-a', quantity: 40 },
        { bin_id: 'b3', item_id: 'it-c', quantity: 400 },
      ],
      transfers: [{ id: 't2', transfer_no: 'TRF-2', status: 'completed', priority: 'normal', itemName: 'it-b', quantity: 5, created_at: new Date().toISOString() }],
      dispatches: [],
      pickLists: [],
      replenishmentRules: [],
      movements: [],
    }));
    expect(vm2.recommendations.some(r => r.id === 'rec-clear')).toBe(true);
  });

  it('labels movement types', () => {
    expect(movementTypeLabel('pick')).toBe('Picked');
    expect(movementTypeLabel('nonsense')).toBe('nonsense');
  });
});
