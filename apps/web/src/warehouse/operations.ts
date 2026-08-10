// src/warehouse/operations.ts
// Phase 4 — Warehouse Operations. Pure, framework-free business rules for the
// Stock Movement Engine (PRD §9.10–§9.25):
//   * Internal Transfer lifecycle & priorities (PRD §9.11–§9.13)
//   * Transfer validation (PRD §9.19) — capacity, weight, blocked/reserved
//     bins, quality-hold destinations, same-bin guards
//   * Put-away suggestions (PRD §9.16) — nearest empty bin by storage role
//   * Replenishment engine (PRD §9.14) — Bulk → Picking refill trigger
//   * Consolidation suggestions (PRD §9.17)
//   * Overflow management (PRD §9.18)
//   * Movement audit records (PRD §9.23)
//
// Everything here is deterministic and unit-tested (operations.test.ts). The
// service layer + RPCs (migration 005) execute these rules against the DB.

import type { TransferPriority, TransferStatus, MovementType } from './types';

// ─── Transfer state machine (PRD §9.13) ────────────────────────────────────

export const TRANSFER_STATUSES: TransferStatus[] = [
  'draft', 'requested', 'approved', 'picking', 'in_transit', 'received',
  'completed', 'cancelled', 'rejected',
];

export const TRANSFER_PRIORITIES: TransferPriority[] = [
  'low', 'normal', 'high', 'urgent', 'critical',
];

export const TRANSFER_PRIORITY_ORDER: Record<TransferPriority, number> = {
  low: 0, normal: 1, high: 2, urgent: 3, critical: 4,
};

/** Allowed transitions. Terminal states have no outgoing edges. */
export const TRANSFER_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  draft: ['requested', 'cancelled'],
  requested: ['approved', 'picking', 'rejected', 'cancelled'],
  approved: ['picking', 'cancelled'],
  picking: ['in_transit', 'cancelled'],
  in_transit: ['received'],
  received: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function canTransition(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Human labels + Tailwind badge colours for statuses. */
export const TRANSFER_STATUS_META: Record<TransferStatus, { label: string; badge: string }> = {
  draft:     { label: 'Draft',     badge: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  requested: { label: 'Requested', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved:  { label: 'Approved',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  picking:   { label: 'Picking',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_transit:{ label: 'In Transit',badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  received:  { label: 'Received',  badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  completed: { label: 'Completed', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-50 text-red-600 border-red-200' },
  rejected:  { label: 'Rejected',  badge: 'bg-rose-50 text-rose-600 border-rose-200' },
};

export const TRANSFER_PRIORITY_META: Record<TransferPriority, { label: string; badge: string; rank: number }> = {
  low:      { label: 'Low',      badge: 'bg-zinc-100 text-zinc-500 border-zinc-200', rank: 0 },
  normal:   { label: 'Normal',   badge: 'bg-sky-50 text-sky-700 border-sky-200',     rank: 1 },
  high:     { label: 'High',     badge: 'bg-amber-50 text-amber-700 border-amber-200', rank: 2 },
  urgent:   { label: 'Urgent',   badge: 'bg-orange-50 text-orange-700 border-orange-200', rank: 3 },
  critical: { label: 'Critical', badge: 'bg-red-50 text-red-700 border-red-200',     rank: 4 },
};

// ─── Transfer validation (PRD §9.19) ────────────────────────────────────────

export interface BinLocation {
  id: string;
  name: string;
  /** Storage-role code of the bin's zone (bulk_storage, picking, dispatch…). */
  storageRole?: string;
  maxQuantity?: number | null;
  maxWeightKg?: number | null;
  blocked?: boolean;
  reserved?: boolean;
}

export interface TransferValidationInput {
  quantity: number;
  source: BinLocation | null;
  destination: BinLocation | null;
  /** Quantity already in the destination bin for the same item. */
  destinationCurrentQty?: number;
  /** Per-unit item weight (kg). Optional — checked when provided. */
  itemWeightKg?: number | null;
}

export interface TransferIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate a transfer before creation/execution. Returns every problem found
 * (not just the first) so the UI can show a complete checklist (PRD §9.19:
 * capacity, dimensions, weight, volume, blocked bin, reserved bin, quality hold).
 */
export function validateTransfer(input: TransferValidationInput): TransferIssue[] {
  const issues: TransferIssue[] = [];

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    issues.push({ code: 'qty_positive', message: 'Quantity must be greater than zero', severity: 'error' });
  }
  if (!input.source) {
    issues.push({ code: 'source_required', message: 'Source bin is required', severity: 'error' });
  }
  if (!input.destination) {
    issues.push({ code: 'dest_required', message: 'Destination bin is required', severity: 'error' });
  }
  if (input.source && input.destination && input.source.id === input.destination.id) {
    issues.push({ code: 'same_bin', message: 'Source and destination cannot be the same bin', severity: 'error' });
  }
  if (input.source?.blocked) {
    issues.push({ code: 'source_blocked', message: 'Source bin is blocked', severity: 'error' });
  }
  if (input.destination?.blocked) {
    issues.push({ code: 'dest_blocked', message: 'Destination bin is blocked', severity: 'error' });
  }
  if (input.destination?.reserved) {
    issues.push({ code: 'dest_reserved', message: 'Destination bin is reserved for another purpose', severity: 'warning' });
  }
  if (input.destination?.storageRole === 'quality_hold' && input.source?.storageRole !== 'quality_hold') {
    issues.push({
      code: 'quality_hold_dest',
      message: 'Moving into a Quality Hold zone requires approval',
      severity: 'warning',
    });
  }

  // Capacity.
  const destMax = input.destination?.maxQuantity;
  if (destMax != null && destMax > 0) {
    const projected = (input.destinationCurrentQty ?? 0) + input.quantity;
    if (projected > destMax) {
      issues.push({
        code: 'capacity_exceeded',
        message: `Destination capacity exceeded: ${input.destinationCurrentQty ?? 0} + ${input.quantity} > ${destMax}`,
        severity: 'error',
      });
    }
  }

  // Weight (only when item weight is known).
  if (input.itemWeightKg != null && input.itemWeightKg > 0 && input.destination?.maxWeightKg != null) {
    const total = input.itemWeightKg * input.quantity;
    if (total > input.destination.maxWeightKg) {
      issues.push({
        code: 'weight_exceeded',
        message: `Destination weight capacity exceeded: ${total.toFixed(1)} kg > ${input.destination.maxWeightKg} kg`,
        severity: 'error',
      });
    }
  }

  return issues;
}

export function hasErrors(issues: TransferIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}

// ─── Put-away suggestions (PRD §9.16) ──────────────────────────────────────

export interface PutawayCandidate extends BinLocation {
  currentQty: number;
  freeCapacity: number;
  /** Optional display extras carried through from the candidate source. */
  zoneName?: string | null;
  warehouseId?: string | null;
  qualityHold?: boolean;
  /** 0 = exact storage-role match, 1 = any other role. Lower ranks first. */
  roleMatchPenalty?: number;
}

/** Input row shape for suggestion engines (subset of what services return). */
export type PutawayInput = Omit<PutawayCandidate, 'roleMatchPenalty'>;

export interface PutawaySuggestInput {
  /** Preferred storage role for this item (e.g. 'bulk_storage'). */
  preferredStorageRole: string;
  quantity: number;
  bins: PutawayInput[];
}/**
 * Suggest where to put away received stock. Ranking (PRD §9.16 — "nearest
 * empty bin, correct storage role, available capacity"):
 *   1. Correct storage role
 *   2. Least-utilised bin first (empty/partial bins before nearly-full ones —
 *      spreads load and keeps bigger bins free for future receipts)
 *   3. Largest free capacity as a final tiebreak
 * Never suggests a blocked or reserved bin.
 */
export function suggestPutaway(input: PutawaySuggestInput): PutawayCandidate[] {
  return input.bins
    .filter(b => !b.blocked && !b.reserved && b.freeCapacity >= input.quantity)
    .map(b => ({
      ...b,
      roleMatchPenalty: b.storageRole === input.preferredStorageRole ? 0 : 1,
    }))
    .sort((a, b) =>
      a.roleMatchPenalty - b.roleMatchPenalty ||
      a.currentQty - b.currentQty ||
      b.freeCapacity - a.freeCapacity
    );
}

// ─── Replenishment engine (PRD §9.14, TAD §5.18) ────────────────────────────

export interface ReplenishmentRuleView {
  ruleId: string;
  binId: string;
  binName: string;
  itemId: string | null;
  itemName?: string;
  minQty: number;
  maxQty: number;
  /** Current quantity in the bin for the rule's item. */
  currentQty: number;
  enabled: boolean;
}

export interface BulkSourceView {
  binId: string;
  binName: string;
  storageRole: string;
  /** The item this source holds. Sources are matched to the rule's item. */
  itemId: string | null;
  availableQty: number;
}

export interface ReplenishmentNeed {
  rule: ReplenishmentRuleView;
  deficit: number;
  /** Suggested bulk sources, best first (largest available qty). */
  sources: BulkSourceView[];
}

export interface ReplenishmentInput {
  rules: ReplenishmentRuleView[];
  /** All bins that could serve as bulk sources (bulk_storage role). */
  bulkBins: BulkSourceView[];
}

/**
 * Find every picking bin below its minimum that has at least one bulk source
 * holding the SAME item available. Returns the deficit and ranked sources so
 * the UI can show "Refill 250 → Picking Bin B4-03 from Bulk Bin K2-05".
 * Bulk sources holding a different item are never suggested (execution would
 * fail at the RPC with "Insufficient bulk stock").
 */
export function computeReplenishmentNeeds(input: ReplenishmentInput): ReplenishmentNeed[] {
  return input.rules
    .filter(r => r.enabled && r.currentQty < r.minQty)
    .map(rule => {
      const sources = input.bulkBins
        .filter(b => b.storageRole === 'bulk_storage'
          && b.itemId != null
          && rule.itemId != null
          && b.itemId === rule.itemId
          && b.availableQty > 0)
        .sort((a, b) => b.availableQty - a.availableQty);
      const need = rule.minQty - rule.currentQty;
      return { rule, deficit: need, sources };
    })
    .sort((a, b) => (b.rule.currentQty - a.rule.currentQty) || (a.rule.maxQty - b.rule.maxQty));
}

// ─── Consolidation suggestions (PRD §9.17) ──────────────────────────────────

export interface ConsolidationCandidate {
  itemId: string | null;
  itemName?: string;
  /** Bins holding the item, least-full first. */
  bins: { binId: string; binName: string; currentQty: number; freeCapacity: number }[];
  /** How much would be freed by merging all-but-one bin. */
  consolidatableQty: number;
}

/**
 * Find items scattered across multiple partially-filled bins where merging
 * would free at least one bin entirely.
 */
export function suggestConsolidation(
  groups: Array<{
    itemId: string | null;
    itemName?: string;
    bins: { binId: string; binName: string; currentQty: number; freeCapacity: number }[];
  }>
): ConsolidationCandidate[] {
  const out: ConsolidationCandidate[] = [];
  for (const g of groups) {
    if (g.bins.length < 2) continue;
    // Target the bin with the most stock; everything else must fit into it.
    const sorted = [...g.bins].sort((a, b) => b.currentQty - a.currentQty);
    const target = sorted[0];
    const others = sorted.slice(1);
    const othersTotal = others.reduce((s, b) => s + b.currentQty, 0);
    if (target.freeCapacity >= othersTotal) {
      out.push({
        itemId: g.itemId,
        itemName: g.itemName,
        bins: sorted,
        consolidatableQty: othersTotal,
      });
    }
  }
  return out.sort((a, b) => b.consolidatableQty - a.consolidatableQty);
}

// ─── Overflow management (PRD §9.18) ────────────────────────────────────────

export interface OverflowSuggestion {
  /** Why the preferred location is unavailable. */
  reason: 'capacity_full' | 'no_matching_role' | 'blocked';
  /** Fallback candidates, best first. */
  candidates: PutawayCandidate[];
}

/**
 * When put-away finds no bin of the preferred role with enough capacity,
 * recommend overflow: bins of any role with free capacity, then reserve/temp
 * storage. (Future: AI-driven overflow per roadmap.)
 */
export function suggestOverflow(
  preferredStorageRole: string,
  quantity: number,
  bins: PutawayInput[]
): OverflowSuggestion {
  // Every non-blocked, non-reserved bin with room qualifies as a fallback.
  const eligible = bins.filter(b => !b.blocked && !b.reserved && b.freeCapacity >= quantity);
  // Preferred-role bins regardless of capacity — used to explain WHY overflow.
  const sameRoleAll = bins.filter(b => b.storageRole === preferredStorageRole);
  const sameRoleEligible = eligible.filter(b => b.storageRole === preferredStorageRole);
  let reason: OverflowSuggestion['reason'] = 'no_matching_role';
  if (eligible.length === 0) reason = 'blocked';
  else if (sameRoleAll.length === 0) reason = 'no_matching_role';
  else if (sameRoleEligible.length === 0) reason = 'capacity_full';
  // Preferred-role bins have room — nothing is actually overflowing.
  return {
    reason,
    candidates: suggestPutaway({ preferredStorageRole, quantity, bins: eligible }),
  };
}

// ─── Movement audit builder (PRD §9.23) ─────────────────────────────────────

export interface MovementDraft {
  movementType: MovementType;
  referenceType: string;
  referenceId?: string | null;
  itemId?: string | null;
  sourceBinId?: string | null;
  destinationBinId?: string | null;
  quantity: number;
  operatorId?: string | null;
  device?: string | null;
  remarks?: string | null;
}

/**
 * Build the two audit rows for a transfer execution (transfer_out negative,
 * transfer_in positive). Mirrors what execute_warehouse_transfer inserts.
 */
export function buildTransferMovements(transfer: {
  id: string;
  itemId?: string | null;
  sourceBinId: string;
  destinationBinId: string;
  quantity: number;
  operatorId?: string | null;
  device?: string | null;
}): [MovementDraft, MovementDraft] {
  return [
    {
      movementType: 'transfer_out',
      referenceType: 'transfer',
      referenceId: transfer.id,
      itemId: transfer.itemId,
      sourceBinId: transfer.sourceBinId,
      destinationBinId: transfer.destinationBinId,
      quantity: -Math.abs(transfer.quantity),
      operatorId: transfer.operatorId,
      device: transfer.device,
      remarks: 'Internal transfer — source decrement',
    },
    {
      movementType: 'transfer_in',
      referenceType: 'transfer',
      referenceId: transfer.id,
      itemId: transfer.itemId,
      sourceBinId: transfer.sourceBinId,
      destinationBinId: transfer.destinationBinId,
      quantity: Math.abs(transfer.quantity),
      operatorId: transfer.operatorId,
      device: transfer.device,
      remarks: 'Internal transfer — destination increment',
    },
  ];
}

/** Next logical action label for a transfer, by status (drives the UI buttons). */
export function nextTransferAction(status: TransferStatus): { label: string; to: TransferStatus } | null {
  switch (status) {
    case 'draft': return { label: 'Submit', to: 'requested' };
    case 'requested': return { label: 'Approve', to: 'approved' };
    case 'approved': return { label: 'Start Picking', to: 'picking' };
    case 'picking': return { label: 'Mark In Transit', to: 'in_transit' };
    case 'in_transit': return { label: 'Confirm Receipt', to: 'received' };
    case 'received': return { label: 'Complete', to: 'completed' };
    default: return null;
  }
}

/** Sort transfers: open first, then critical first, then oldest unresolved. */
export function sortTransfersByPriority<T extends { status: TransferStatus; priority: TransferPriority; created_at?: string }>(
  transfers: T[]
): T[] {
  const closed = (s: TransferStatus) => (s === 'completed' || s === 'cancelled' || s === 'rejected' ? 1 : 0);
  return [...transfers].sort((a, b) => {
    const open = closed(a.status) - closed(b.status);
    if (open !== 0) return open;
    const pr = TRANSFER_PRIORITY_ORDER[b.priority] - TRANSFER_PRIORITY_ORDER[a.priority];
    if (pr !== 0) return pr;
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });
}
