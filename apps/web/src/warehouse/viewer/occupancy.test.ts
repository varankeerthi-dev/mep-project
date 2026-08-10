import { describe, it, expect } from 'vitest';
import {
  levelForPct,
  computeBinOccupancy,
  sumQuantitiesByBin,
  aggregateCapacity,
  OCCUPANCY_COLORS,
} from './occupancy';
import type { BinRow } from '../types';

describe('levelForPct', () => {
  it('classifies every PRD §6.9 band', () => {
    expect(levelForPct(0, true)).toBe('empty');
    expect(levelForPct(25, true)).toBe('low'); // 0–50
    expect(levelForPct(50, true)).toBe('low'); // boundary inclusive
    expect(levelForPct(51, true)).toBe('mid'); // 51–75
    expect(levelForPct(75, true)).toBe('mid');
    expect(levelForPct(76, true)).toBe('high'); // 76–90
    expect(levelForPct(90, true)).toBe('high');
    expect(levelForPct(91, true)).toBe('full'); // 91–100
    expect(levelForPct(100, true)).toBe('full');
    expect(levelForPct(120, true)).toBe('over'); // over capacity
  });

  it('treats unconfigured capacity as empty regardless of pct', () => {
    expect(levelForPct(0, false)).toBe('empty');
    expect(levelForPct(50, false)).toBe('empty');
  });
});

describe('computeBinOccupancy', () => {
  it('computes pct, remaining and level for a normal bin', () => {
    const occ = computeBinOccupancy(380, 500);
    expect(occ.currentQty).toBe(380);
    expect(occ.maxQty).toBe(500);
    expect(occ.remaining).toBe(120);
    expect(occ.pct).toBe(76); // PRD §6.8 example
    expect(occ.level).toBe('high');
    expect(occ.color).toBe(OCCUPANCY_COLORS.high);
    expect(occ.label).toBe('76–90%');
  });

  it('clamps negative quantities to zero', () => {
    const occ = computeBinOccupancy(-10, 100);
    expect(occ.currentQty).toBe(0);
    expect(occ.level).toBe('empty');
  });

  it('handles unconfigured max qty (no capacity)', () => {
    const occ = computeBinOccupancy(5, null);
    expect(occ.maxQty).toBe(0);
    expect(occ.pct).toBe(0);
    expect(occ.level).toBe('empty');
    expect(occ.remaining).toBe(0);
  });

  it('flags over-capacity bins', () => {
    const occ = computeBinOccupancy(120, 100);
    expect(occ.pct).toBe(120);
    expect(occ.level).toBe('over');
    expect(occ.remaining).toBe(0);
  });
});

describe('sumQuantitiesByBin', () => {
  it('sums quantities per bin, skipping empty rows', () => {
    const map = sumQuantitiesByBin([
      { bin_id: 'b1', quantity: 10 },
      { bin_id: 'b1', quantity: 5 },
      { bin_id: 'b2', quantity: 3 },
      { bin_id: 'b2', quantity: null },
      { bin_id: 'b3', quantity: 0 },
    ]);
    expect(map.get('b1')).toBe(15);
    expect(map.get('b2')).toBe(3);
    expect(map.has('b3')).toBe(false); // zero qty skipped
  });

  it('returns empty map for no rows', () => {
    expect(sumQuantitiesByBin([]).size).toBe(0);
  });
});

describe('aggregateCapacity', () => {
  const bins = (partials: Array<Partial<BinRow> & { id: string }>): BinRow[] =>
    partials.map(p => ({ max_quantity: null, current_quantity: null, ...p } as BinRow));

  it('aggregates across bins, only counting configured capacity', () => {
    const stats = aggregateCapacity(
      bins([
        { id: 'b1', max_quantity: 500 },
        { id: 'b2', max_quantity: 300 },
        { id: 'b3', max_quantity: null },
      ]),
      new Map([
        ['b1', 250],
        ['b2', 60],
      ])
    );
    expect(stats.binCount).toBe(3);
    expect(stats.configuredBinCount).toBe(2);
    expect(stats.currentQty).toBe(310);
    expect(stats.maxQty).toBe(800);
    expect(stats.pct).toBe(38.8); // rounded to 1dp by toFixed(1)
    expect(stats.remaining).toBe(490);
    expect(stats.level).toBe('low');
  });

  it('is empty-grey when nothing is configured', () => {
    const stats = aggregateCapacity(bins([{ id: 'b1' }]), new Map());
    expect(stats.pct).toBe(0);
    expect(stats.level).toBe('empty');
    expect(stats.color).toBe(OCCUPANCY_COLORS.empty);
  });

  it('treats stored current_quantity as fallback when no bin items exist', () => {
    const stats = aggregateCapacity(
      bins([{ id: 'b1', max_quantity: 100, current_quantity: 40 }]),
      new Map() // no bin items in Phase 2
    );
    expect(stats.currentQty).toBe(40);
    expect(stats.pct).toBe(40);
  });
});
