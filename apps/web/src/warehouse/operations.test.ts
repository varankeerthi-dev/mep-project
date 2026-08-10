// src/warehouse/operations.test.ts
// Unit tests for the Phase 4 Stock Movement Engine rules (PRD §9.10–§9.25).

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  TRANSFER_TRANSITIONS,
  validateTransfer,
  hasErrors,
  suggestPutaway,
  suggestOverflow,
  computeReplenishmentNeeds,
  suggestConsolidation,
  buildTransferMovements,
  nextTransferAction,
  sortTransfersByPriority,
  TRANSFER_PRIORITY_ORDER,
} from './operations';
import type { TransferPriority, TransferStatus } from './types';

// ─── State machine (PRD §9.13) ──────────────────────────────────────────────

describe('transfer state machine', () => {
  it('follows the documented lifecycle', () => {
    const path: TransferStatus[] = ['draft', 'requested', 'approved', 'picking', 'in_transit', 'received', 'completed'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('allows cancel from every open state', () => {
    for (const s of ['draft', 'requested', 'approved', 'picking'] as TransferStatus[]) {
      expect(canTransition(s, 'cancelled')).toBe(true);
    }
  });

  it('allows reject only from requested', () => {
    expect(canTransition('requested', 'rejected')).toBe(true);
    for (const s of ['approved', 'picking', 'in_transit', 'received', 'completed'] as TransferStatus[]) {
      expect(canTransition(s, 'rejected')).toBe(false);
    }
  });

  it('blocks illegal and terminal-state transitions', () => {
    expect(canTransition('draft', 'completed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'requested')).toBe(false);
    expect(canTransition('in_transit', 'picking')).toBe(false);
  });

  it('every transition target is itself a valid status', () => {
    for (const [from, targets] of Object.entries(TRANSFER_TRANSITIONS)) {
      for (const to of targets) {
        expect(TRANSFER_TRANSITIONS[to], `${from} → ${to}`).toBeDefined();
      }
    }
  });
});

// ─── Transfer validation (PRD §9.19) ─────────────────────────────────────────

const base = {
  quantity: 10,
  source: { id: 'src', name: 'SRC', storageRole: 'bulk_storage', maxQuantity: 100, maxWeightKg: 1000 },
  destination: { id: 'dst', name: 'DST', storageRole: 'picking', maxQuantity: 100, maxWeightKg: 1000 },
};

describe('validateTransfer', () => {
  it('accepts a valid transfer', () => {
    expect(hasErrors(validateTransfer({ ...base, destinationCurrentQty: 20 }))).toBe(false);
  });

  it('rejects zero / negative quantities', () => {
    const issues = validateTransfer({ ...base, quantity: 0 });
    expect(issues.some(i => i.code === 'qty_positive')).toBe(true);
  });

  it('rejects same source and destination', () => {
    const issues = validateTransfer({ ...base, source: base.destination });
    expect(issues.some(i => i.code === 'same_bin')).toBe(true);
  });

  it('rejects capacity overflow at destination', () => {
    const issues = validateTransfer({ ...base, quantity: 60, destinationCurrentQty: 50 }); // 110 > 100
    expect(issues.some(i => i.code === 'capacity_exceeded')).toBe(true);
  });

  it('accepts capacity exactly at the limit', () => {
    const issues = validateTransfer({ ...base, quantity: 50, destinationCurrentQty: 50 }); // 100 === 100
    expect(issues.some(i => i.code === 'capacity_exceeded')).toBe(false);
  });

  it('rejects blocked source and destination bins', () => {
    const src = validateTransfer({ ...base, source: { ...base.source!, blocked: true } });
    const dst = validateTransfer({ ...base, destination: { ...base.destination!, blocked: true } });
    expect(src.some(i => i.code === 'source_blocked')).toBe(true);
    expect(dst.some(i => i.code === 'dest_blocked')).toBe(true);
  });

  it('warns on reserved destination', () => {
    const issues = validateTransfer({ ...base, destination: { ...base.destination!, reserved: true } });
    const warn = issues.find(i => i.code === 'dest_reserved');
    expect(warn?.severity).toBe('warning');
    expect(hasErrors(issues)).toBe(false);
  });

  it('warns when moving into a quality-hold zone from outside', () => {
    const issues = validateTransfer({
      ...base,
      destination: { ...base.destination!, storageRole: 'quality_hold' },
    });
    expect(issues.some(i => i.code === 'quality_hold_dest')).toBe(true);
  });

  it('does not warn when both ends are quality hold', () => {
    const issues = validateTransfer({
      ...base,
      source: { ...base.source!, storageRole: 'quality_hold' },
      destination: { ...base.destination!, storageRole: 'quality_hold' },
    });
    expect(issues.some(i => i.code === 'quality_hold_dest')).toBe(false);
  });

  it('checks weight when item weight is provided', () => {
    const issues = validateTransfer({ ...base, quantity: 500, itemWeightKg: 3 }); // 1500 > 1000
    expect(issues.some(i => i.code === 'weight_exceeded')).toBe(true);
    const ok = validateTransfer({ ...base, quantity: 100, itemWeightKg: 3 }); // 300 < 1000
    expect(ok.some(i => i.code === 'weight_exceeded')).toBe(false);
  });

  it('collects every problem, not just the first', () => {
    const issues = validateTransfer({
      quantity: 0,
      source: null,
      destination: null,
    });
    expect(issues.some(i => i.code === 'qty_positive')).toBe(true);
    expect(issues.some(i => i.code === 'source_required')).toBe(true);
    expect(issues.some(i => i.code === 'dest_required')).toBe(true);
    expect(issues.length).toBe(3);
  });
});

// ─── Put-away suggestions (PRD §9.16) ────────────────────────────────────────

describe('suggestPutaway', () => {
  const bins = [
    { id: 'b1', name: 'B1', storageRole: 'receiving', currentQty: 0, freeCapacity: 100 },
    { id: 'b2', name: 'B2', storageRole: 'bulk_storage', currentQty: 10, freeCapacity: 200 },
    { id: 'b3', name: 'B3', storageRole: 'receiving', currentQty: 40, freeCapacity: 60 },
    { id: 'b4', name: 'B4', storageRole: 'dispatch', currentQty: 0, freeCapacity: 500 },
  ];

  it('ranks same-role bins first', () => {
    const result = suggestPutaway({ preferredStorageRole: 'receiving', quantity: 50, bins });
    expect(result[0].storageRole).toBe('receiving');
    expect(result.every((b, i) => i === 0 || b.storageRole !== 'receiving' || b.roleMatchPenalty === 0)).toBe(true);
  });

  it('filters bins without enough capacity', () => {
    const result = suggestPutaway({ preferredStorageRole: 'receiving', quantity: 500, bins });
    expect(result.every(b => b.freeCapacity >= 500)).toBe(true);
    expect(result.length).toBe(1); // only b4
  });

  it('excludes blocked and reserved bins', () => {
    const withBlocked = [
      ...bins,
      { id: 'bx', name: 'BX', storageRole: 'receiving', currentQty: 0, freeCapacity: 9999, blocked: true },
      { id: 'by', name: 'BY', storageRole: 'receiving', currentQty: 0, freeCapacity: 9999, reserved: true },
    ];
    const result = suggestPutaway({ preferredStorageRole: 'receiving', quantity: 10, bins: withBlocked });
    expect(result.some(b => b.id === 'bx')).toBe(false);
    expect(result.some(b => b.id === 'by')).toBe(false);
  });

  it('prefers the least-utilised bin among same-role ties', () => {
    const result = suggestPutaway({ preferredStorageRole: 'receiving', quantity: 10, bins });
    const receiving = result.filter(b => b.storageRole === 'receiving');
    expect(receiving[0].id).toBe('b1'); // currentQty 0 beats b3 (40)
  });
});

// ─── Overflow management (PRD §9.18) ─────────────────────────────────────────

describe('suggestOverflow', () => {
  it('falls back to other storage roles when preferred is full', () => {
    const fullOnly = [
      { id: 'a', name: 'A', storageRole: 'receiving', currentQty: 95, freeCapacity: 5 },
      { id: 'b', name: 'B', storageRole: 'bulk_storage', currentQty: 0, freeCapacity: 500 },
    ];
    const result = suggestOverflow('receiving', 100, fullOnly);
    expect(result.reason).toBe('capacity_full');
    expect(result.candidates[0].id).toBe('b');
  });

  it('reports blocked when nothing qualifies', () => {
    const blockedAll = [
      { id: 'a', name: 'A', storageRole: 'receiving', currentQty: 0, freeCapacity: 500, blocked: true },
    ];
    const result = suggestOverflow('receiving', 10, blockedAll);
    expect(result.reason).toBe('blocked');
    expect(result.candidates).toHaveLength(0);
  });
});

// ─── Replenishment engine (PRD §9.14) ────────────────────────────────────────

describe('computeReplenishmentNeeds', () => {
  const rules = [
    { ruleId: 'r1', binId: 'p1', binName: 'P1', itemId: 'i1', itemName: 'Resin', minQty: 100, maxQty: 400, currentQty: 30, enabled: true },
    { ruleId: 'r2', binId: 'p2', binName: 'P2', itemId: 'i2', itemName: 'Pigment', minQty: 50, maxQty: 200, currentQty: 200, enabled: true },
    { ruleId: 'r3', binId: 'p3', binName: 'P3', itemId: 'i1', itemName: 'Resin', minQty: 80, maxQty: 300, currentQty: 60, enabled: false },
  ];
  const bulkBins = [
    { binId: 'k1', binName: 'K1', storageRole: 'bulk_storage', itemId: 'i1', availableQty: 500 },
    { binId: 'k2', binName: 'K2', storageRole: 'bulk_storage', itemId: 'i1', availableQty: 20 },
  ];

  it('flags only enabled rules below minimum', () => {
    const needs = computeReplenishmentNeeds({ rules, bulkBins });
    expect(needs.map(n => n.rule.ruleId)).toEqual(['r1']);
  });

  it('computes the correct deficit', () => {
    const needs = computeReplenishmentNeeds({ rules, bulkBins });
    expect(needs[0].deficit).toBe(70); // 100 - 30
  });

  it('sorts bulk sources largest first', () => {
    const needs = computeReplenishmentNeeds({ rules, bulkBins });
    expect(needs[0].sources.map(s => s.binId)).toEqual(['k1', 'k2']);
  });

  it('never suggests bulk sources holding a different item', () => {
    const needs = computeReplenishmentNeeds({
      rules: [{ ...rules[0], itemId: 'i9' }],
      bulkBins: [{ ...bulkBins[0], itemId: 'i1' }],
    });
    expect(needs).toHaveLength(1);
    expect(needs[0].sources).toHaveLength(0);
  });

  it('skips rules without an item (nothing to match)', () => {
    const needs = computeReplenishmentNeeds({
      rules: [{ ...rules[0], itemId: null }],
      bulkBins,
    });
    expect(needs).toHaveLength(1);
    expect(needs[0].sources).toHaveLength(0);
  });

  it('returns empty when no rule is below minimum', () => {
    const ok = [{ ...rules[1] }];
    expect(computeReplenishmentNeeds({ rules: ok, bulkBins })).toHaveLength(0);
  });
});

// ─── Consolidation (PRD §9.17) ───────────────────────────────────────────────

describe('suggestConsolidation', () => {
  it('suggests merging when partial bins fit into the largest one', () => {
    const groups = [
      {
        itemId: 'i1',
        itemName: 'Pipes',
        bins: [
          { binId: 'a', binName: 'A', currentQty: 20, freeCapacity: 80 },
          { binId: 'b', binName: 'B', currentQty: 30, freeCapacity: 70 },
          { binId: 'c', binName: 'C', currentQty: 40, freeCapacity: 60 },
        ],
      },
    ];
    const result = suggestConsolidation(groups);
    expect(result).toHaveLength(1);
    // Target C (40 stock, 60 free): A + B = 50 ≤ 60 → merge frees 2 bins.
    expect(result[0].consolidatableQty).toBe(50);
  });

  it('does not suggest when the target bin cannot hold the others', () => {
    const groups = [
      {
        itemId: 'i1',
        itemName: 'Pipes',
        bins: [
          { binId: 'a', binName: 'A', currentQty: 20, freeCapacity: 80 },
          { binId: 'b', binName: 'B', currentQty: 30, freeCapacity: 70 },
          { binId: 'c', binName: 'C', currentQty: 100, freeCapacity: 0 },
        ],
      },
    ];
    expect(suggestConsolidation(groups)).toHaveLength(0);
  });

  it('skips items that cannot fit together', () => {
    const groups = [
      {
        itemId: 'i1',
        itemName: 'Heavy',
        bins: [
          { binId: 'a', binName: 'A', currentQty: 80, freeCapacity: 20 },
          { binId: 'b', binName: 'B', currentQty: 90, freeCapacity: 10 },
        ],
      },
    ];
    expect(suggestConsolidation(groups)).toHaveLength(0);
  });

  it('ignores items in a single bin', () => {
    const groups = [{ itemId: 'i1', bins: [{ binId: 'a', binName: 'A', currentQty: 10, freeCapacity: 90 }] }];
    expect(suggestConsolidation(groups)).toHaveLength(0);
  });
});

// ─── Movement audit builder (PRD §9.23) ──────────────────────────────────────

describe('buildTransferMovements', () => {
  it('produces a negative out and positive in pair', () => {
    const [out, inn] = buildTransferMovements({
      id: 't1',
      itemId: 'i1',
      sourceBinId: 'src',
      destinationBinId: 'dst',
      quantity: 25,
      operatorId: 'op1',
    });
    expect(out.movementType).toBe('transfer_out');
    expect(out.quantity).toBe(-25);
    expect(out.referenceId).toBe('t1');
    expect(inn.movementType).toBe('transfer_in');
    expect(inn.quantity).toBe(25);
    expect(inn.sourceBinId).toBe('src');
    expect(inn.destinationBinId).toBe('dst');
  });
});

// ─── Next action / sorting ───────────────────────────────────────────────────

describe('nextTransferAction', () => {
  it('maps every open status to its next step', () => {
    expect(nextTransferAction('draft')?.to).toBe('requested');
    expect(nextTransferAction('requested')?.to).toBe('approved');
    expect(nextTransferAction('approved')?.to).toBe('picking');
    expect(nextTransferAction('picking')?.to).toBe('in_transit');
    expect(nextTransferAction('in_transit')?.to).toBe('received');
    expect(nextTransferAction('received')?.to).toBe('completed');
    expect(nextTransferAction('completed')).toBeNull();
    expect(nextTransferAction('cancelled')).toBeNull();
  });
});

describe('sortTransfersByPriority', () => {
  const mk = (id: string, status: TransferStatus, priority: TransferPriority, created_at: string) =>
    ({ id, status, priority, created_at } as const);

  it('puts open transfers before closed ones', () => {
    const list = [
      mk('a', 'completed', 'high', '2026-01-01'),
      mk('b', 'requested', 'low', '2026-01-02'),
    ];
    expect(sortTransfersByPriority(list).map(t => t.id)).toEqual(['b', 'a']);
  });

  it('sorts open transfers critical-first, then oldest', () => {
    const list = [
      mk('a', 'approved', 'low', '2026-01-01'),
      mk('b', 'requested', 'critical', '2026-01-03'),
      mk('c', 'requested', 'high', '2026-01-02'),
    ];
    const sorted = sortTransfersByPriority(list).map(t => t.id);
    expect(sorted).toEqual(['b', 'c', 'a']);
  });

  it('priority order ranks critical above urgent', () => {
    expect(TRANSFER_PRIORITY_ORDER.critical).toBeGreaterThan(TRANSFER_PRIORITY_ORDER.urgent);
    expect(TRANSFER_PRIORITY_ORDER.urgent).toBeGreaterThan(TRANSFER_PRIORITY_ORDER.high);
    expect(TRANSFER_PRIORITY_ORDER.high).toBeGreaterThan(TRANSFER_PRIORITY_ORDER.normal);
    expect(TRANSFER_PRIORITY_ORDER.normal).toBeGreaterThan(TRANSFER_PRIORITY_ORDER.low);
  });
});
