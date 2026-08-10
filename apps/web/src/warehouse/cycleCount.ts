// src/warehouse/cycleCount.ts
// Phase 7 — Inventory Accuracy: Cycle Count (PRD §4.21, Phase 7 spec).
// Pure, framework-free rules:
//   * ABC classification — rank stocked items by movement value/velocity and
//     bucket into A (top ~10%, count often), B (~30%), C (rest, count less
//     often). Deterministic + unit-tested.
//   * Blind count — variance is computed from the operator's entry against
//     expected; the UI never shows expected while counting.
//   * Status machine — scheduled → in_progress → completed (+ cancelled).
//   * Variance classification — matched (0) vs variance (≠0), with a
//     tolerance so tiny rounding differences don't spawn investigations.
//   * Freeze guards — canFreeze / canApprove checks mirror the RPC rules.

import type { CycleCountBatchStatus } from './types';

// ─── ABC classification ──────────────────────────────────────────────────────

export interface AbcCandidate {
  itemId: string | null;
  itemName?: string | null;
  /** Movement velocity in the window (e.g. count of pick movements). */
  velocity: number;
  /** Optional value contribution (qty × unit value); used as tiebreak. */
  valueContribution?: number;
}

export interface AbcAssignment {
  itemId: string | null;
  itemName?: string | null;
  klass: 'A' | 'B' | 'C';
}

/**
 * Rank items by velocity (descending) and bucket:
 *   A = top 10%, B = next 30%, C = remaining 60% (classic 10/30/60 split).
 * Items with zero velocity always land in C. Ties break on value.
 */
export function classifyAbc(items: AbcCandidate[]): AbcAssignment[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const v = (b.velocity ?? 0) - (a.velocity ?? 0);
    if (v !== 0) return v;
    return ((b.valueContribution ?? 0) - (a.valueContribution ?? 0)) || String(a.itemId ?? '').localeCompare(String(b.itemId ?? ''));
  });
  const n = sorted.length;
  const aBound = Math.max(1, Math.ceil(n * 0.1));
  const bBound = Math.max(aBound + 1, Math.ceil(n * 0.4));
  return sorted.map((it, i) => ({
    itemId: it.itemId,
    itemName: it.itemName,
    klass: i < aBound ? 'A' : i < bBound ? 'B' : 'C',
  }));
}

// ─── Blind-count variance ────────────────────────────────────────────────────

export interface VarianceResult {
  variance: number;
  status: 'matched' | 'variance';
}

/**
 * Blind count: the operator enters counted_qty without seeing expected.
 * Variance = counted − expected. Within |tolerance| → matched, else variance.
 */
export function computeVariance(expectedQty: number, countedQty: number, tolerance = 0): VarianceResult {
  const variance = (Number(countedQty) || 0) - (Number(expectedQty) || 0);
  return Math.abs(variance) <= tolerance
    ? { variance, status: 'matched' }
    : { variance, status: 'variance' };
}

// ─── Batch status machine ────────────────────────────────────────────────────

export const CYCLE_BATCH_TRANSITIONS: Record<CycleCountBatchStatus, CycleCountBatchStatus[]> = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canCycleTransition(from: CycleCountBatchStatus, to: CycleCountBatchStatus): boolean {
  return CYCLE_BATCH_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CYCLE_STATUS_META: Record<CycleCountBatchStatus, { label: string; badge: string }> = {
  scheduled: { label: 'Scheduled', badge: 'bg-zinc-50 text-zinc-600 border-zinc-200' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-50 text-red-600 border-red-200' },
};

/** Queue ordering for the dashboard (PRD §4.21). */
export const CYCLE_QUEUE_ORDER: CycleCountBatchStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

// ─── Freeze / approval guards (mirror the RPC rules) ─────────────────────────

export function canFreeze(status: CycleCountBatchStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

export function canApprove(status: CycleCountBatchStatus, pendingLines: number): boolean {
  return status === 'in_progress' && pendingLines === 0;
}

export function canCancel(status: CycleCountBatchStatus): boolean {
  return status === 'scheduled' || status === 'in_progress';
}

export type { CycleCountBatchStatus };
