// src/warehouse/reversal.ts
// TAD §5.12 — Movement Reversal. Pure, framework-free rules mirroring the
// reverse_warehouse_movement RPC (migration 007):
//   * A transfer is recorded as a PAIR of rows (transfer_out −q, transfer_in
//     +q) for ONE logical movement, so reversal operates on the whole
//     REFERENCE GROUP and applies the NET inverse effect exactly once.
//   * Effect model: source loses |qty|, destination gains |qty|. Reversal
//     inverts that (source gains, destination loses).
//   * Guards: no reversing a reversal, no reversing an already-reversed
//     movement, no zero-quantity movements, no bin-less movements.
//
// Unit-tested in reversal.test.ts. The RPC executes the reversal atomically.

import type { MovementRow } from './types';

/** One bin's net reversal effect. delta > 0 → stock is restored to the bin. */
export interface ReversalEffect {
  binId: string;
  delta: number;
}

export const REVERSAL_META: Record<string, { label: string; badge: string }> = {
  reversal: { label: 'Reversal', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
};

/** A movement can be reversed unless it's itself a reversal, already reversed, empty, or bin-less. */
export function canReverseMovement(m: MovementRow): { ok: true } | { ok: false; reason: string } {
  if (m.movement_type === 'reversal') return { ok: false, reason: 'Cannot reverse a reversal' };
  if (m.reversed_at) return { ok: false, reason: 'Movement already reversed' };
  if (!m.quantity) return { ok: false, reason: 'Movement has no quantity to reverse' };
  if (!m.source_bin_id && !m.destination_bin_id) return { ok: false, reason: 'Movement has no bins to reverse' };
  return { ok: true };
}

/**
 * Group membership — every non-reversed, non-reversal movement of the same
 * reference. When reference_id is NULL (receive / replenish) only the anchor
 * row belongs to the group (mirrors the RPC).
 */
export function reversalGroupMembers(
  anchor: MovementRow,
  all: MovementRow[]
): MovementRow[] {
  if (!anchor.reference_id) return [anchor];
  return all.filter(
    m =>
      m.reference_type === anchor.reference_type &&
      m.reference_id === anchor.reference_id &&
      m.movement_type !== 'reversal' &&
      !m.reversed_at
  );
}

/** Effect of a single movement on stock: source −|qty|, destination +|qty|. */
function movementEffect(m: MovementRow): ReversalEffect[] {
  const q = Math.abs(Number(m.quantity) || 0);
  const out: ReversalEffect[] = [];
  if (m.source_bin_id) out.push({ binId: m.source_bin_id, delta: -q });
  if (m.destination_bin_id) out.push({ binId: m.destination_bin_id, delta: q });
  return out;
}

/**
 * Aggregate a list of movement effects into per-bin net deltas.
 *
 * A transfer is recorded as a PAIR (transfer_out −q, transfer_in +q) for ONE
 * logical movement, so both rows produce the IDENTICAL per-bin effect
 * (src −q, dst +q). Identical (bin, delta) contributions are therefore
 * counted once — summing them would double the reversal (TAD §5.12).
 */
export function netBinEffects(movements: MovementRow[]): ReversalEffect[] {
  const byBin = new Map<string, number>();
  const seen = new Set<string>();
  for (const m of movements) {
    for (const e of movementEffect(m)) {
      const key = `${e.binId}|${e.delta}`;
      if (seen.has(key)) continue;
      seen.add(key);
      byBin.set(e.binId, (byBin.get(e.binId) ?? 0) + e.delta);
    }
  }
  return [...byBin.entries()].map(([binId, delta]) => ({ binId, delta }));
}

/** The reversal = the INVERSE of the group's net effect. */
export function reverseEffects(effects: ReversalEffect[]): ReversalEffect[] {
  return effects.map(e => ({ binId: e.binId, delta: -e.delta }));
}

/**
 * Full reversal plan for an anchor movement against the org's movement list:
 * the group, its net effect, the inverse to apply, and which movements get
 * marked reversed. Returns a failure reason when reversal is not possible.
 */
export function buildReversalPlan(
  anchor: MovementRow,
  all: MovementRow[]
): { ok: true; group: MovementRow[]; effects: ReversalEffect[] } | { ok: false; reason: string } {
  const guard = canReverseMovement(anchor);
  if ('reason' in guard) return { ok: false, reason: guard.reason };

  const group = reversalGroupMembers(anchor, all);
  if (group.length === 0) return { ok: false, reason: 'No reversible movements in this reference' };

  // All rows of a reference must share the same item (a transfer pair does).
  const items = new Set(group.map(m => m.item_id ?? '__null__'));
  if (items.size > 1) return { ok: false, reason: 'Reference mixes multiple items — cannot reverse as a unit' };

  return { ok: true, group, effects: reverseEffects(netBinEffects(group)) };
}

