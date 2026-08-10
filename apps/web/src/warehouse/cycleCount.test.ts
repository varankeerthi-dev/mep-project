// src/warehouse/cycleCount.test.ts
// Unit tests for the Phase 7 cycle-count pure rules.

import { describe, it, expect } from 'vitest';
import {
  classifyAbc,
  computeVariance,
  canCycleTransition,
  CYCLE_STATUS_META,
  CYCLE_QUEUE_ORDER,
  canFreeze,
  canApprove,
  canCancel,
} from './cycleCount';

describe('classifyAbc', () => {
  it('buckets 10/30/60 by velocity', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      itemId: `it-${i}`,
      velocity: 100 - i, // descending velocity
    }));
    const out = classifyAbc(items);
    expect(out.filter(x => x.klass === 'A').length).toBe(1); // top 10%
    expect(out.filter(x => x.klass === 'B').length).toBe(3); // next 30%
    expect(out.filter(x => x.klass === 'C').length).toBe(6);
  });

  it('ranks highest velocity first', () => {
    const out = classifyAbc([
      { itemId: 'a', velocity: 5 },
      { itemId: 'b', velocity: 50 },
    ]);
    expect(out[0].itemId).toBe('b');
    expect(out[0].klass).toBe('A');
  });

  it('zero velocity items land in C (not A)', () => {
    const out = classifyAbc([
      { itemId: 'hot', velocity: 90 },
      { itemId: 'warm', velocity: 40 },
      { itemId: 'dead', velocity: 0 },
    ]);
    expect(out.find(x => x.itemId === 'dead')?.klass).toBe('C');
    expect(out.find(x => x.itemId === 'hot')?.klass).toBe('A');
  });

  it('returns empty for empty input', () => {
    expect(classifyAbc([])).toEqual([]);
  });
});

describe('computeVariance (blind count)', () => {
  it('matches exact counts', () => {
    expect(computeVariance(40, 40)).toEqual({ variance: 0, status: 'matched' });
  });

  it('flags a difference as variance', () => {
    expect(computeVariance(40, 35)).toEqual({ variance: -5, status: 'variance' });
    expect(computeVariance(40, 45)).toEqual({ variance: 5, status: 'variance' });
  });

  it('tolerates tiny differences within tolerance', () => {
    expect(computeVariance(40, 40.5, 1)).toEqual({ variance: 0.5, status: 'matched' });
    expect(computeVariance(40, 42, 1)).toEqual({ variance: 2, status: 'variance' });
  });
});

describe('cycle batch state machine', () => {
  it('follows scheduled → in_progress → completed', () => {
    expect(canCycleTransition('scheduled', 'in_progress')).toBe(true);
    expect(canCycleTransition('in_progress', 'completed')).toBe(true);
    expect(canCycleTransition('scheduled', 'completed')).toBe(false);
  });

  it('allows cancel from open states only', () => {
    expect(canCycleTransition('scheduled', 'cancelled')).toBe(true);
    expect(canCycleTransition('in_progress', 'cancelled')).toBe(true);
    expect(canCycleTransition('completed', 'cancelled')).toBe(false);
  });

  it('exposes queue order + labels (PRD §4.21)', () => {
    expect(CYCLE_QUEUE_ORDER[0]).toBe('scheduled');
    expect(CYCLE_STATUS_META.in_progress.label).toBe('In Progress');
  });
});

describe('freeze / approval guards', () => {
  it('freezes only open batches', () => {
    expect(canFreeze('scheduled')).toBe(true);
    expect(canFreeze('in_progress')).toBe(true);
    expect(canFreeze('completed')).toBe(false);
    expect(canFreeze('cancelled')).toBe(false);
  });

  it('approves only in-progress batches with zero pending lines', () => {
    expect(canApprove('in_progress', 0)).toBe(true);
    expect(canApprove('in_progress', 2)).toBe(false);
    expect(canApprove('scheduled', 0)).toBe(false);
    expect(canApprove('completed', 0)).toBe(false);
  });

  it('cancels only open batches', () => {
    expect(canCancel('scheduled')).toBe(true);
    expect(canCancel('in_progress')).toBe(true);
    expect(canCancel('completed')).toBe(false);
  });
});
