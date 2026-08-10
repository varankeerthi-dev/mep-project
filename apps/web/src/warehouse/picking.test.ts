// src/warehouse/picking.test.ts
// Unit tests for TAD §3.12 Picking Module (pure module).

import { describe, it, expect } from 'vitest';
import {
  canPickTransition,
  PICK_STATUS_META,
  nextPickAction,
  recommendPickBins,
  validatePickList,
  pickHasErrors,
  buildPickCompletionPlan,
} from './picking';
import type { PickListRow, PickListItemRow } from './types';

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe('pick list lifecycle', () => {
  it('follows queued → picking → completed', () => {
    expect(canPickTransition('queued', 'picking')).toBe(true);
    expect(canPickTransition('picking', 'completed')).toBe(true);
    expect(canPickTransition('queued', 'completed')).toBe(false);
  });

  it('allows cancel from queued and picking only', () => {
    expect(canPickTransition('queued', 'cancelled')).toBe(true);
    expect(canPickTransition('picking', 'cancelled')).toBe(true);
    expect(canPickTransition('completed', 'cancelled')).toBe(false);
  });

  it('nextPickAction maps open states', () => {
    expect(nextPickAction('queued')?.to).toBe('picking');
    expect(nextPickAction('picking')?.to).toBe('completed');
    expect(nextPickAction('completed')).toBeNull();
    expect(nextPickAction('cancelled')).toBeNull();
    expect(PICK_STATUS_META.queued.label).toBe('Queued');
  });
});

// ─── Bin recommendation ──────────────────────────────────────────────────────

const bins = [
  { id: 'b1', name: 'PK-01', storageRole: 'picking', itemQty: 50, isPrimary: true, isReserve: false },
  { id: 'b2', name: 'PK-02', storageRole: 'picking', itemQty: 80, isPrimary: false, isReserve: true },
  { id: 'b3', name: 'BLK-01', storageRole: 'bulk', itemQty: 500, isPrimary: false, isReserve: false },
  { id: 'b4', name: 'PK-03', storageRole: 'picking', itemQty: 5, isPrimary: false, isReserve: false },
  { id: 'b5', name: 'BLK-02', storageRole: 'bulk', itemQty: 10, isPrimary: false, isReserve: false, blocked: true },
];

describe('recommendPickBins', () => {
  it('prefers primary picking bin over reserve picking bin over bulk', () => {
    const r = recommendPickBins({ itemId: 'x', quantity: 40, bins });
    expect(r.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('excludes bins with insufficient stock and blocked bins', () => {
    const r = recommendPickBins({ itemId: 'x', quantity: 40, bins });
    expect(r.some(b => b.id === 'b4')).toBe(false); // only 5 available
    expect(r.some(b => b.id === 'b5')).toBe(false); // blocked
  });

  it('falls back to any eligible bin when no picking-role bin has stock', () => {
    // qty 100 eliminates every picking-role bin (b1 50, b2 80, b4 5) — only
    // b3 (bulk, 500) qualifies, so it wins by necessity.
    const r = recommendPickBins({ itemId: 'x', quantity: 100, bins });
    expect(r[0].id).toBe('b3');
    expect(r.every(b => b.itemQty >= 100)).toBe(true);
  });

  it('returns empty for zero quantity', () => {
    expect(recommendPickBins({ itemId: 'x', quantity: 0, bins })).toEqual([]);
  });

  it('ranks tightest-fit first among equal roles', () => {
    const r = recommendPickBins({ itemId: 'x', quantity: 30, bins: [
      { id: 'a', name: 'PK-A', storageRole: 'picking', itemQty: 100, isPrimary: false, isReserve: false },
      { id: 'b', name: 'PK-B', storageRole: 'picking', itemQty: 35, isPrimary: false, isReserve: false },
    ]});
    expect(r.map(b => b.id)).toEqual(['b', 'a']);
  });
});

// ─── Pick validation ─────────────────────────────────────────────────────────

describe('validatePickList', () => {
  const lines = [
    { id: 'L1', itemId: 'it-1', sourceBinId: 'b1', quantityRequested: 40, quantityPicked: 40 },
    { id: 'L2', itemId: 'it-1', sourceBinId: 'b2', quantityRequested: 10, quantityPicked: 15 },
    { id: 'L3', itemId: 'it-2', sourceBinId: 'b4', quantityRequested: 5, quantityPicked: 5 },
    // L4 picks 100 from b1 which only holds 50 — genuinely insufficient.
    { id: 'L4', itemId: 'it-3', sourceBinId: 'b1', quantityRequested: 50, quantityPicked: 100 },
  ];

  it('passes a valid line', () => {
    const v = validatePickList({ lines: [lines[0]], bins });
    expect(v[0].issues).toEqual([]);
  });

  it('flags picking more than requested as a warning', () => {
    const v = validatePickList({ lines: [lines[1]], bins });
    expect(v[0].issues.some(i => i.code === 'pick_over_request' && i.severity === 'warning')).toBe(true);
  });

  it('flags insufficient stock as an error', () => {
    const v = validatePickList({ lines: [lines[3]], bins });
    expect(v[0].issues.some(i => i.code === 'insufficient_stock')).toBe(true);
    expect(pickHasErrors(v)).toBe(true);
  });

  it('collects multiple problems per line', () => {
    const v = validatePickList({ lines: [lines[3]], bins });
    const codes = v[0].issues.map(i => i.code);
    expect(codes).toContain('insufficient_stock');
    expect(codes).toContain('pick_over_request');
  });

  it('flags zero picked quantity', () => {
    const v = validatePickList({ lines: [{ ...lines[0], quantityPicked: 0 }], bins });
    expect(v[0].issues.some(i => i.code === 'picked_positive')).toBe(true);
  });

  it('warns when picked exceeds a zero requested quantity', () => {
    const v = validatePickList({ lines: [{ ...lines[0], quantityRequested: 0, quantityPicked: 5 }], bins });
    expect(v[0].issues.some(i => i.code === 'request_zero' && i.severity === 'warning')).toBe(true);
  });

  it('warns when picking from a reserve bin directly', () => {
    const v = validatePickList({ lines: [lines[1]], bins });
    expect(v[0].issues.some(i => i.code === 'reserve_source')).toBe(true);
  });
});

// ─── Completion plan ─────────────────────────────────────────────────────────

describe('buildPickCompletionPlan', () => {
  const list = { id: 'PL1', pick_no: 'PK-000001' } as PickListRow;
  const lines = [
    { id: 'L1', pick_list_id: 'PL1', source_bin_id: 'b1', quantity_requested: 40, quantity_picked: 40, status: 'pending' },
    { id: 'L2', pick_list_id: 'PL1', source_bin_id: 'b2', quantity_requested: 10, quantity_picked: 0, status: 'pending' },
    { id: 'L3', pick_list_id: 'PL1', source_bin_id: 'b3', quantity_requested: 5, quantity_picked: 5, status: 'picked' },
  ] as unknown as PickListItemRow[];

  it('includes pending lines with positive picked qty and excludes picked/empty', () => {
    const plan = buildPickCompletionPlan(list, lines);
    expect(plan.map(p => p.lineId)).toEqual(['L1']);
    expect(plan[0].quantityPicked).toBe(40);
    expect(plan[0].sourceBinId).toBe('b1');
  });
});
