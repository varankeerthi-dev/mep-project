// src/warehouse/reversal.test.ts
// Unit tests for TAD §5.12 movement reversal logic (pure module).

import { describe, it, expect } from 'vitest';
import {
  canReverseMovement,
  reversalGroupMembers,
  netBinEffects,
  reverseEffects,
  buildReversalPlan,
} from './reversal';
import type { MovementRow } from './types';

function mv(partial: Partial<MovementRow> & { id: string }): MovementRow {
  return {
    movement_type: 'transfer_in',
    reference_type: 'transfer',
    reference_id: null,
    quantity: 0,
    ...partial,
  } as MovementRow;
}

// ─── Guards ─────────────────────────────────────────────────────────────────

describe('canReverseMovement', () => {
  it('rejects a reversal movement', () => {
    expect(canReverseMovement(mv({ id: 'r', movement_type: 'reversal' }))).toEqual({
      ok: false, reason: 'Cannot reverse a reversal',
    });
  });

  it('rejects an already-reversed movement', () => {
    expect(canReverseMovement(mv({ id: 'm', reversed_at: '2026-01-02T00:00:00Z' }))).toEqual({
      ok: false, reason: 'Movement already reversed',
    });
  });

  it('rejects zero quantity', () => {
    expect(canReverseMovement(mv({ id: 'm', quantity: 0 }))).toEqual({
      ok: false, reason: 'Movement has no quantity to reverse',
    });
  });

  it('rejects a movement with no bins', () => {
    expect(canReverseMovement(mv({ id: 'm', quantity: 5, source_bin_id: null, destination_bin_id: null }))).toEqual({
      ok: false, reason: 'Movement has no bins to reverse',
    });
  });

  it('accepts a normal movement', () => {
    expect(canReverseMovement(mv({ id: 'm', quantity: 5, source_bin_id: 'src', destination_bin_id: 'dst' }))).toEqual({ ok: true });
  });
});

// ─── Group membership ───────────────────────────────────────────────────────

describe('reversalGroupMembers', () => {
  const tOut = mv({ id: 'out', movement_type: 'transfer_out', reference_id: 'T1', quantity: -10, source_bin_id: 'src', destination_bin_id: 'dst' });
  const tIn = mv({ id: 'in', movement_type: 'transfer_in', reference_id: 'T1', quantity: 10, source_bin_id: 'src', destination_bin_id: 'dst' });

  it('groups the full transfer pair', () => {
    const anchor = tOut;
    const ids = reversalGroupMembers(anchor, [tOut, tIn]).map(m => m.id).sort();
    expect(ids).toEqual(['in', 'out']);
  });

  it('excludes reversed and reversal rows from the group', () => {
    const rev = mv({ id: 'rev', movement_type: 'reversal', reference_id: 'T1', quantity: 10 });
    const already = mv({ id: 'done', movement_type: 'transfer_out', reference_id: 'T1', quantity: -10, reversed_at: 'x' });
    const ids = reversalGroupMembers(tOut, [tOut, tIn, rev, already]).map(m => m.id).sort();
    expect(ids).toEqual(['in', 'out']);
  });

  it('is anchor-only when reference_id is null (receive / replenish)', () => {
    const rec = mv({ id: 'rcv', movement_type: 'receive', reference_type: 'receiving', reference_id: null, quantity: 5, destination_bin_id: 'bin' });
    expect(reversalGroupMembers(rec, [rec, mv({ id: 'other', reference_type: 'receiving', reference_id: null, quantity: 3, destination_bin_id: 'bin2' })]).map(m => m.id))
      .toEqual(['rcv']);
  });
});

// ─── Net effects ────────────────────────────────────────────────────────────

describe('netBinEffects / reverseEffects', () => {
  it('transfer pair nets to source −q, destination +q exactly once', () => {
    const pair = [
      mv({ id: 'out', movement_type: 'transfer_out', quantity: -10, source_bin_id: 'src', destination_bin_id: 'dst' }),
      mv({ id: 'in', movement_type: 'transfer_in', quantity: 10, source_bin_id: 'src', destination_bin_id: 'dst' }),
    ];
    const effects = netBinEffects(pair);
    expect(effects).toEqual([
      { binId: 'src', delta: -10 },
      { binId: 'dst', delta: 10 },
    ]);
  });

  it('reversal inverts every bin delta', () => {
    const reversed = reverseEffects([{ binId: 'src', delta: -10 }, { binId: 'dst', delta: 10 }]);
    expect(reversed).toEqual([
      { binId: 'src', delta: 10 },
      { binId: 'dst', delta: -10 },
    ]);
  });

  it('receive (destination only) reverses to a pure removal', () => {
    const rec = mv({ id: 'r', movement_type: 'receive', reference_type: 'receiving', quantity: 5, destination_bin_id: 'bin' });
    expect(reverseEffects(netBinEffects([rec]))).toEqual([{ binId: 'bin', delta: -5 }]);
  });

  it('dispatch (source only) reverses to a pure restoration', () => {
    const dsp = mv({ id: 'd', movement_type: 'dispatch', reference_type: 'dispatch', quantity: -7, source_bin_id: 'src' });
    expect(reverseEffects(netBinEffects([dsp]))).toEqual([{ binId: 'src', delta: 7 }]);
  });
});

// ─── Full plan ──────────────────────────────────────────────────────────────

describe('buildReversalPlan', () => {
  it('produces the correct inverse plan for a transfer pair', () => {
    const tOut = mv({ id: 'out', movement_type: 'transfer_out', reference_id: 'T1', quantity: -10, source_bin_id: 'src', destination_bin_id: 'dst' });
    const tIn = mv({ id: 'in', movement_type: 'transfer_in', reference_id: 'T1', quantity: 10, source_bin_id: 'src', destination_bin_id: 'dst' });
    const plan = buildReversalPlan(tOut, [tOut, tIn]);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.group.map(m => m.id).sort()).toEqual(['in', 'out']);
      expect(plan.effects).toEqual([
        { binId: 'src', delta: 10 },
        { binId: 'dst', delta: -10 },
      ]);
    }
  });

  it('fails when the reference mixes multiple items', () => {
    const tOut = mv({ id: 'out', movement_type: 'transfer_out', reference_id: 'T1', quantity: -10, source_bin_id: 'src', destination_bin_id: 'dst' });
    const tIn = mv({ id: 'in', movement_type: 'transfer_in', reference_id: 'T1', quantity: 10, source_bin_id: 'src', destination_bin_id: 'dst', item_id: 'OTHER' });
    const plan = buildReversalPlan(tOut, [tOut, tIn]);
    expect(plan).toEqual({ ok: false, reason: 'Reference mixes multiple items — cannot reverse as a unit' });
  });

  it('fails when the anchor cannot be reversed', () => {
    const done = mv({ id: 'done', movement_type: 'transfer_out', reference_id: 'T1', quantity: -10, reversed_at: 'x' });
    expect(buildReversalPlan(done, [done])).toEqual({ ok: false, reason: 'Movement already reversed' });
  });
});
