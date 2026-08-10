// src/warehouse/picking.ts
// TAD §3.12 — Picking Module. Pure, framework-free rules:
//   * Generate Pick Lists   — lifecycle state machine (queued → picking →
//                             completed, + cancelled)
//   * Recommend Bins         — rank candidate source bins for an item:
//                             picking storage-role bins first, primary
//                             picking bin first, then other bins holding the
//                             item; always filtered to available qty ≥ asked.
//   * Pick Validation        — validate proposed picked quantities against
//                             live available stock + source eligibility.
//   * Completion             — planned via buildPickCompletionPlan (the RPC
//                             in migration 009 executes it through the
//                             Movement Engine).
//
// Route optimization is explicitly FUTURE (TAD §3.12).
// Unit-tested in picking.test.ts.

import type { PickListItemRow, PickListRow, PickListStatus, TransferPriority } from './types';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export const PICK_STATUSES: PickListStatus[] = ['queued', 'picking', 'completed', 'cancelled'];

export const PICK_TRANSITIONS: Record<PickListStatus, PickListStatus[]> = {
  queued: ['picking', 'cancelled'],
  picking: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canPickTransition(from: PickListStatus, to: PickListStatus): boolean {
  return PICK_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PICK_STATUS_META: Record<PickListStatus, { label: string; badge: string }> = {
  queued: { label: 'Queued', badge: 'bg-zinc-50 text-zinc-600 border-zinc-200' },
  picking: { label: 'Picking', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-50 text-red-600 border-red-200' },
};

export function nextPickAction(status: PickListStatus): { label: string; to: PickListStatus } | null {
  if (status === 'queued') return { label: 'Start Picking', to: 'picking' };
  if (status === 'picking') return { label: 'Complete Pick', to: 'completed' };
  return null;
}

// ─── Bin recommendation (TAD §3.12 — Recommend Bins) ─────────────────────────

/** A bin that holds the item, with live availability for ranking. */
export interface PickBinCandidate {
  id: string;
  name: string;
  storageRole?: string | null;
  zoneName?: string | null;
  itemQty: number;          // live qty of the item in this bin
  isPrimary: boolean;       // primary picking bin flag
  isReserve: boolean;
  blocked?: boolean | null;
}

export interface RecommendBinsInput {
  itemId: string;
  quantity: number;
  bins: PickBinCandidate[];
}

/** Ranked source-bin recommendations for a pick list line (TAD §3.12). */
export function recommendPickBins(input: RecommendBinsInput): PickBinCandidate[] {
  const q = Number(input.quantity) || 0;
  if (q <= 0) return [];

  const eligible = input.bins.filter(
    b => b.itemQty > 0 && !b.blocked && b.itemQty >= q
  );

  const score = (b: PickBinCandidate): number => {
    const isPickingRole = (b.storageRole ?? '').toLowerCase() === 'picking';
    let s = 0;
    // Picking-role bins first (that's WHY they exist), primary picking bin
    // within that role first.
    if (isPickingRole) s += 100;
    if (isPickingRole && b.isPrimary) s += 50;
    else if (isPickingRole && b.isReserve) s += 25;
    // Tightest-fit first among equals (leaves larger bins for bigger picks).
    s += Math.max(0, 100 - (b.itemQty - q)); // full coverage = 100
    return s;
  };

  return [...eligible].sort((a, b) => score(b) - score(a));
}

// ─── Pick validation (TAD §3.12 — Pick Validation) ───────────────────────────

export interface PickLineValidation {
  lineId: string;
  issues: Array<{ code: string; severity: 'error' | 'warning'; message: string }>;
}

export interface ValidatePickInput {
  lines: Array<{
    id: string;
    itemId: string | null;
    sourceBinId: string | null;
    quantityRequested: number | null;
    quantityPicked: number | null;
  }>;
  bins: PickBinCandidate[];
}

/** Validate every line of a pick list before completion. */
export function validatePickList(input: ValidatePickInput): PickLineValidation[] {
  return input.lines.map(line => {
    const issues: PickLineValidation['issues'] = [];
    const asked = Number(line.quantityRequested) || 0;
    const picked = Number(line.quantityPicked) || 0;

    if (picked <= 0) {
      issues.push({ code: 'picked_positive', severity: 'error', message: 'Picked quantity must be positive' });
    }
    if (asked <= 0 && picked > 0) {
      issues.push({ code: 'request_zero', severity: 'warning', message: 'Line has no requested quantity — verify the pick list was built correctly' });
    }
    if (!line.sourceBinId) {
      issues.push({ code: 'source_required', severity: 'error', message: 'Source bin is required' });
    }
    if (picked > asked) {
      issues.push({ code: 'pick_over_request', severity: 'warning', message: 'Picked quantity exceeds the requested quantity' });
    }

    if (line.sourceBinId) {
      const bin = input.bins.find(b => b.id === line.sourceBinId);
      if (!bin) {
        issues.push({ code: 'source_unknown', severity: 'error', message: 'Source bin not found' });
      } else {
        if (bin.blocked) {
          issues.push({ code: 'source_blocked', severity: 'error', message: 'Source bin is blocked' });
        }
        if (bin.itemQty < picked) {
          issues.push({
            code: 'insufficient_stock',
            severity: 'error',
            message: `Only ${bin.itemQty} available in ${bin.name} (need ${picked})`,
          });
        }
        // Reserve bins are eligible sources, but flag when a reserve bin is
        // being picked directly while a primary picking bin holds stock.
        if (bin.isReserve && !bin.isPrimary) {
          issues.push({
            code: 'reserve_source',
            severity: 'warning',
            message: 'Picking from a reserve bin — check the primary picking bin first',
          });
        }
      }
    }

    return { lineId: line.id, issues };
  });
}

export function pickHasErrors(validations: PickLineValidation[]): boolean {
  return validations.some(v => v.issues.some(i => i.severity === 'error'));
}

// ─── Completion plan ─────────────────────────────────────────────────────────

export interface PickCompletionLine {
  lineId: string;
  itemId: string | null;
  sourceBinId: string;
  quantityPicked: number;
}

/** Lines the completion RPC will execute (positive picked qty, pending only). */
export function buildPickCompletionPlan(
  list: PickListRow,
  lines: PickListItemRow[]
): PickCompletionLine[] {
  return lines
    .filter(l => l.status !== 'picked' && (Number(l.quantity_picked) || 0) > 0)
    .map(l => ({
      lineId: l.id,
      itemId: l.item_id ?? null,
      sourceBinId: l.source_bin_id,
      quantityPicked: Number(l.quantity_picked) || 0,
    }));
}

export type { PickListStatus, TransferPriority };
